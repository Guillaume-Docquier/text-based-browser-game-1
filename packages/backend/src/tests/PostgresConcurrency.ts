import { setTimeout as delay } from "node:timers/promises"
import { Assert, FatalError } from "@guillaume-docquier/tools-ts"
import { getTableName } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import type { Pool, PoolClient } from "pg"

const SCHEDULE_TIMEOUT_MS = 5_000

type Session = {
  pid: number
  query: string
  state: string
  waitEvent: string | null
  waitEventType: string | null
  blockers: number[]
}

type BlockedQuery = {
  blockedBy: number
  command: "select" | "insert" | "delete" | "update"
  table: PgTable
  lock: "table" | "row"
  excludingPids?: readonly number[]
}

/** Controls scheduling only. Game state is created and checked through the API. */
export class PostgresConcurrency {
  private readonly pool: Pool

  public constructor(pool: Pool) {
    this.pool = pool
  }

  public async blockWrites(table: PgTable): Promise<PostgresWriteBlock> {
    const client = await this.pool.connect()
    const block = new PostgresWriteBlock(client)
    // Register disposal before acquiring the lock, including when acquisition fails.
    await using _acquisition = {
      [Symbol.asyncDispose]: async (): Promise<void> => {
        if (!block.acquired) {
          await block.release()
        }
      },
    }
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout = '5s'")
    const tableName = getTableName(table).replaceAll('"', '""')
    await client.query(`LOCK TABLE "${tableName}" IN SHARE MODE`)
    const result = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    Assert.isDefined(result.rows[0])
    block.markAcquired(result.rows[0].pid)
    return block
  }

  /** A timeout is a failed schedule, never evidence that a request was blocked. */
  public async waitForBlockedQuery(expected: BlockedQuery): Promise<number> {
    const deadline = performance.now() + SCHEDULE_TIMEOUT_MS
    const tableName = getTableName(expected.table)
    let sessions: Session[] = []
    do {
      sessions = await this.readSessions()
      const matching = sessions.filter((session) => {
        const query = session.query.toLowerCase().replaceAll(/\s+/g, " ").trim()
        const tableClause =
          expected.command === "select" || expected.command === "delete" ? "from" : expected.command === "insert" ? "into" : "update"
        return (
          session.state === "active" &&
          session.waitEventType === "Lock" &&
          (expected.lock === "table"
            ? session.waitEvent === "relation"
            : session.waitEvent === "transactionid" || session.waitEvent === "tuple") &&
          session.blockers.includes(expected.blockedBy) &&
          !(expected.excludingPids ?? []).includes(session.pid) &&
          query.startsWith(`${expected.command} `) &&
          query.includes(`${tableClause} "${tableName}"`)
        )
      })
      if (matching.length === 1) {
        Assert.isDefined(matching[0])
        return matching[0].pid
      }
      if (matching.length > 1) {
        throw new FatalError("More than one session matches the expected blocked query", {
          expected: { ...expected, table: tableName },
          sessions,
        })
      }
      await delay(10)
    } while (performance.now() < deadline)

    throw new FatalError("Concurrency schedule was not established", { expected: { ...expected, table: tableName }, sessions })
  }

  /** Used when SKIP LOCKED must let another processor finish before releasing the first. */
  public async waitForCompletion<T>(operation: Promise<T>): Promise<T> {
    const deadline = Promise.withResolvers<undefined>()
    using _timer = setTimeout(() => {
      deadline.resolve(undefined)
    }, SCHEDULE_TIMEOUT_MS)
    const completed = await Promise.race([operation.then((value) => ({ value })), deadline.promise])
    if (completed === undefined) {
      throw new FatalError("Concurrent operation did not finish while the first remained blocked", { sessions: await this.readSessions() })
    }
    return completed.value
  }

  private async readSessions(): Promise<Session[]> {
    const result = await this.pool.query<Session>(`
      SELECT pid, query, state, wait_event AS "waitEvent", wait_event_type AS "waitEventType",
             pg_blocking_pids(pid) AS blockers
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      ORDER BY pid
    `)
    return result.rows
  }
}

export class PostgresWriteBlock {
  private readonly client: PoolClient
  private backendPid: number | undefined
  private released = false

  public constructor(client: PoolClient) {
    this.client = client
  }

  public get acquired(): boolean {
    return this.backendPid !== undefined
  }

  public get pid(): number {
    Assert.isDefined(this.backendPid)
    return this.backendPid
  }

  public markAcquired(pid: number): void {
    this.backendPid = pid
  }

  public async release(): Promise<void> {
    if (this.released) {
      return
    }
    this.released = true
    // Destroying the connection also releases its lock if ROLLBACK fails.
    using _connection = {
      [Symbol.dispose]: (): void => {
        this.client.release(true)
      },
    }
    await this.client.query("ROLLBACK")
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.release()
  }
}
