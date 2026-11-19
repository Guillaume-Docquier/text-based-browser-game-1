import type { Database } from "#lib/db/createDb.ts"

type PostgresDb = Omit<Database, "$client">

export abstract class PostgresRepository {
  protected readonly db

  public constructor({ db }: { db: PostgresDb }) {
    this.db = db
  }
}
