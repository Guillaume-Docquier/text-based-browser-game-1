import { setTimeout as delay } from "node:timers/promises"
import { Assert, Logger, type Result } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createCreateTransaction, type CreateTransaction, type Database, type Transaction } from "#lib/db/createDb.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { POSTGRES_IMAGE } from "#tests/ConcurrencyTestApiServer.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

const SYNCHRONIZATION_TIMEOUT_MS = 5_000

/**
 * Real PostgreSQL and HTTP API with a controlled clock and no background processor.
 * Game setup and observations go through the API; SQL access is only for migrations
 * and observing PostgreSQL sessions. Each worker owns a separate connection pool.
 */
export class TurnConcurrencyFixture {
  public readonly clock: ControlledClock
  public readonly api: ApiServer
  public readonly apiTransactions: ControlledTransactions
  private readonly resources: AsyncDisposableStack
  private readonly databaseUrl: string
  private readonly observer: Pool
  private readonly processing = new Set<Promise<"processed" | "idle" | "failed">>()

  /**
   * Owns an isolated PostgreSQL container, migrated schema and seeded test ruleset.
   * Startup failures dispose every resource already created.
   */
  public static async create(): Promise<TurnConcurrencyFixture> {
    await using resources = new AsyncDisposableStack()
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
    resources.defer(async () => {
      await container.stop()
    })
    const databaseUrl = container.getConnectionUri()
    const db = createSession(databaseUrl, resources)
    await migrate(db, { migrationsFolder: "./drizzle/" })
    const observer = createSession(databaseUrl, resources).$client
    const clock = new ControlledClock()
    const apiTransactions = new ControlledTransactions(db)
    const services = await createApiStub({ db, clock, createTransaction: apiTransactions.createTransaction })
    extractSuccess(await services.rulesetsRepository.upsertRuleset(TestRuleset))
    const api = resources.use(new ApiServer(services))
    return new TurnConcurrencyFixture({ resources: resources.move(), databaseUrl, observer, clock, api, apiTransactions })
  }

  private constructor({
    resources,
    databaseUrl,
    observer,
    clock,
    api,
    apiTransactions,
  }: {
    resources: AsyncDisposableStack
    databaseUrl: string
    observer: Pool
    clock: ControlledClock
    api: ApiServer
    apiTransactions: ControlledTransactions
  }) {
    this.resources = resources
    this.databaseUrl = databaseUrl
    this.observer = observer
    this.clock = clock
    this.api = api
    this.apiTransactions = apiTransactions
  }

  /**
   * Creates a production processor on a dedicated PostgreSQL session and tracks
   * its invocations so disposal drains them before disconnecting.
   */
  public createWorker(): {
    processNextDueTurn: () => Promise<"processed" | "idle" | "failed">
    repository: TurnsRepository
    transactions: ControlledTransactions
  } {
    const db = createSession(this.databaseUrl, this.resources, 1)
    const logger = Logger.get()
    const transactions = new ControlledTransactions(db)
    const repository = new TurnsRepository({ db, logger })
    const processor = new TurnProcessor({
      logger,
      clock: this.clock,
      turnsRepository: repository,
      createTransaction: transactions.createTransaction,
    })
    return {
      processNextDueTurn: async (): Promise<"processed" | "idle" | "failed"> => {
        const processing = processor.processNextDueTurn()
        this.processing.add(processing)
        void processing.then(
          () => this.processing.delete(processing),
          () => this.processing.delete(processing),
        )
        return await processing
      },
      repository,
      transactions,
    }
  }

  /**
   * Waits for PostgreSQL to report an actual lock wait on the held transaction.
   * The polling interval only observes the database; it does not establish ordering.
   */
  public async waitUntilBlockedBy(pause: TransactionPause): Promise<string> {
    const blockerPid = await pause.waitUntilHeld()
    const deadline = performance.now() + SYNCHRONIZATION_TIMEOUT_MS
    while (performance.now() < deadline) {
      const { rows } = await this.observer.query<{ query: string }>(
        "select query from pg_stat_activity where $1 = any(pg_blocking_pids(pid))",
        [blockerPid],
      )
      if (rows[0] !== undefined) {
        return rows[0].query
      }
      await delay(10)
    }
    throw new Error(`No PostgreSQL session blocked by transaction ${blockerPid}`)
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    // Pauses are disposed before the fixture. Drain workers before closing their pools,
    // including when a bounded wait fails while a worker still owns a transaction.
    await Promise.allSettled(this.processing)
    await this.resources.disposeAsync()
  }
}

/**
 * Pauses the next transaction after its production operation, before commit.
 * Existing reads, writes and locks stay intact; disposal always releases the pause.
 */
export class ControlledTransactions {
  public readonly createTransaction: CreateTransaction
  private nextPause: TransactionPause | undefined

  public constructor(db: Database) {
    const createTransaction = createCreateTransaction(db)
    this.createTransaction = async <T>(operation: (tx: Transaction) => Promise<T>): Promise<Result<T, Error>> => {
      const pause = this.nextPause
      this.nextPause = undefined
      return await createTransaction(async (tx) => {
        const value = await operation(tx)
        if (pause !== undefined) {
          await pause.hold(tx)
        }
        return value
      })
    }
  }

  /**
   * Arms a single pause. Use `using` so failed assertions release held locks.
   */
  public pauseNext(): TransactionPause {
    Assert.isNotDefined(this.nextPause)
    const pause = new TransactionPause()
    this.nextPause = pause
    return pause
  }
}

/**
 * A bounded transaction barrier that exposes the holding PostgreSQL backend PID.
 */
export class TransactionPause {
  private readonly held = Promise.withResolvers<number>()
  private readonly released = Promise.withResolvers<undefined>()

  /**
   * Holds the transaction before commit and publishes its backend PID.
   */
  public async hold(tx: Transaction): Promise<void> {
    const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)
    Assert.isDefined(result.rows[0])
    this.held.resolve(result.rows[0].pid)
    await within(this.released.promise, "Transaction pause was not released", SYNCHRONIZATION_TIMEOUT_MS * 3)
  }

  /**
   * Resolves after the transaction's production reads and writes have completed.
   */
  public async waitUntilHeld(): Promise<number> {
    return await within(this.held.promise, "Transaction did not reach the pause")
  }

  /**
   * Allows the transaction to commit. Safe to call more than once.
   */
  public release(): void {
    this.released.resolve(undefined)
  }

  public [Symbol.dispose](): void {
    this.release()
  }
}

function createSession(databaseUrl: string, resources: AsyncDisposableStack, max = 10): Database {
  const pool = new Pool({ connectionString: databaseUrl, max, statement_timeout: SYNCHRONIZATION_TIMEOUT_MS })
  const clientEnds: Array<Promise<undefined>> = []
  pool.on("connect", (client): void => {
    const ended = Promise.withResolvers<undefined>()
    client.once("end", (): void => {
      ended.resolve(undefined)
    })
    clientEnds.push(ended.promise)
  })
  resources.defer(async () => {
    await pool.end()
    // pg-pool removes idle clients from its bookkeeping before their sockets close.
    // Wait for every client's end event before allowing PostgreSQL to shut down.
    await within(Promise.all(clientEnds), "PostgreSQL clients did not disconnect")
  })
  return drizzle({ client: pool })
}

/**
 * Bounds waits and clears the timer when the operation completes.
 */
export async function within<T>(
  promise: Promise<T>,
  message = "Operation did not complete while the competing transaction was held",
  timeoutMs = SYNCHRONIZATION_TIMEOUT_MS,
): Promise<T> {
  const timeout = Promise.withResolvers<never>()
  const timer = setTimeout(() => {
    timeout.reject(new Error(message))
  }, timeoutMs)
  using _cleanup = {
    [Symbol.dispose]: (): void => {
      clearTimeout(timer)
    },
  }
  return await Promise.race([promise, timeout.promise])
}
