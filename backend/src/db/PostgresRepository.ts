import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export abstract class PostgresRepository {
  protected readonly db

  public constructor({ db }: { db: NodePgDatabase }) {
    this.db = db
  }
}
