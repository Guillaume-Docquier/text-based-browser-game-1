import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export type PostgresDb = NodePgDatabase
export type PostgresTransaction = Parameters<Parameters<PostgresDb["transaction"]>[0]>[0]
export type PostgresExecutor = PostgresDb | PostgresTransaction

export abstract class PostgresRepository {
  protected readonly db: PostgresDb

  public constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }
}

export async function inTransaction<T>(db: PostgresExecutor, callback: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
  if (hasTransaction(db)) {
    return await db.transaction(callback)
  }

  return await callback(db)
}

function hasTransaction(db: PostgresExecutor): db is PostgresDb {
  return "transaction" in db && typeof db.transaction === "function"
}
