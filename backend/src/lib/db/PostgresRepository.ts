import type { Database } from "#lib/db/createDb.ts"

/**
 * We Omit $client from Database because it conflicts with the transaction type.
 * I guess that's because transactions don't have a $client (only the DB does), and that's okay. We don't need to know this here.
 */
type PostgresDb = Omit<Database, "$client">

export abstract class PostgresRepository {
  protected readonly db

  protected constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }
}
