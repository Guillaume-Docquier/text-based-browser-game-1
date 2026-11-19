import type { Database } from "#lib/db/createDb.ts"

// CONSTRAINT: We Omit $client from Database so its compatible with the Transaction type.
type PostgresDb = Omit<Database, "$client">

export abstract class PostgresRepository {
  protected readonly db

  protected constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }
}
