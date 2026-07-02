import type { Database, Transaction } from "#lib/db/createDb.ts"

/**
 * We Omit $client from Database because it conflicts with the transaction type.
 * I guess that's because transactions don't have a $client (only the DB does), and that's okay. We don't need to know this here.
 */
type PostgresDb = Omit<Database, "$client">

export abstract class PostgresRepository {
  protected readonly db

  public constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }

  protected async runInTransaction<T>(db: PostgresDb, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    if ("transaction" in db) {
      return await db.transaction(async (tx) => await operation(tx))
    }

    // SAFETY: Repository methods pass either the root database or an existing transaction.
    // When there is no transaction method, the handle is already the active transaction.
    return await operation(db as Transaction)
  }
}
