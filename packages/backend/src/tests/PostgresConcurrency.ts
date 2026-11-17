import { setTimeout as delay } from "node:timers/promises"
import { Assert, FatalError } from "@guillaume-docquier/tools-ts"
import { getTableName } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import { escapeIdentifier, type Pool } from "pg"

const SCHEDULE_TIMEOUT_MS = 5_000
const TABLE_CLAUSES = {
  select: "from",
  insert: "into",
  delete: "from",
  update: "update",
}

type Session = {
  pid: number
  query: string
  state: string
  waitEvent: string | null
  blockers: number[]
}

type BlockedQuery = {
  blockedBy: number
  command: keyof typeof TABLE_CLAUSES
  table: PgTable
  lock: "table" | "row"
  excludingPid?: number
}

type PostgresWriteBlock = AsyncDisposable & {
  readonly pid: number
  release: () => Promise<void>
}

/** Controls scheduling only. Game state is created and checked through the API. */
export class PostgresConcurrency {
  private readonly pool: Pool

  public constructor(pool: Pool) {
    this.pool = pool
  }

  public async blockWrites(table: PgTable): Promise<PostgresWriteBlock> {
    const tableIdentifier = escapeIdentifier(getTableName(table))
    const client = await this.pool.connect()
    try {
      await client.query(`
        BEGIN;
        SET LOCAL lock_timeout = '${SCHEDULE_TIMEOUT_MS}ms';
        LOCK TABLE ${tableIdentifier} IN SHARE MODE
      `)
      const backendQuery = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      const backend = backendQuery.rows[0]
      Assert.isDefined(backend)

      let rollback: Promise<unknown>
      const release = async (): Promise<void> => {
        await (rollback ??= client.query("ROLLBACK").finally(() => {
          client.release(true)
        }))
      }
      return { pid: backend.pid, release, [Symbol.asyncDispose]: release }
    } catch (error) {
      client.release(true)
      throw error
    }
  }

  public async waitForBlockedQuery(expected: BlockedQuery): Promise<number> {
    const deadline = performance.now() + SCHEDULE_TIMEOUT_MS
    const tableName = getTableName(expected.table)
    const tableClause = `${TABLE_CLAUSES[expected.command]} ${escapeIdentifier(tableName)}`
    const waitEvents = expected.lock === "table" ? ["relation"] : ["transactionid", "tuple"]
    const details = { ...expected, table: tableName }
    // Match the SQL emitted by Drizzle and confirm PostgreSQL reports the expected blocker.
    const matchesExpectedBlockedQuery = ({ pid, query, waitEvent, blockers }: Session): boolean =>
      pid !== expected.excludingPid &&
      blockers.includes(expected.blockedBy) &&
      waitEvents.some((event) => event === waitEvent) &&
      query.startsWith(`${expected.command} `) &&
      query.includes(tableClause)

    let sessions: Session[]
    do {
      sessions = await this.readSessions()
      const [match, other] = sessions.filter(matchesExpectedBlockedQuery)
      if (other !== undefined) {
        throw new FatalError("More than one session matches the expected blocked query", { expected: details, sessions })
      }
      if (match !== undefined) {
        return match.pid
      }
      await delay(10)
    } while (performance.now() < deadline)

    throw new FatalError("Concurrency schedule was not established", { expected: details, sessions })
  }

  /** Verify that a processor can finish while the first remains blocked. */
  public async waitForCompletion<T>(operation: Promise<T>): Promise<T> {
    const timedOut = Symbol("timed out")
    const deadline = Promise.withResolvers<typeof timedOut>()
    using _timer = setTimeout(() => {
      deadline.resolve(timedOut)
    }, SCHEDULE_TIMEOUT_MS)
    const completed = await Promise.race([operation, deadline.promise])
    if (completed === timedOut) {
      throw new FatalError("Concurrent operation did not finish while the first remained blocked", { sessions: await this.readSessions() })
    }
    return completed
  }

  private async readSessions(): Promise<Session[]> {
    const result = await this.pool.query<Session>(`
      SELECT pid, query, state, wait_event AS "waitEvent", pg_blocking_pids(pid) AS blockers
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
    `)
    return result.rows
  }
}
