import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export type PostgresDb = NodePgDatabase
export type PostgresTransaction = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0]
export type PostgresQueryExecutor = PostgresDb | PostgresTransaction

export abstract class PostgresRepository {
  protected readonly db: PostgresDb

  public constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }
}
