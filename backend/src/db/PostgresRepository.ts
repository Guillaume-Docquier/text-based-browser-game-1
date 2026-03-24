import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export class PostgresRepository {
  protected readonly db

  constructor({ db }: { db: NodePgDatabase }) {
    this.db = db
  }
}
