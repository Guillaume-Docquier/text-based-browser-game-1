import { Result } from "@guillaume-docquier/tools-ts"
import { drizzle } from "drizzle-orm/node-postgres"

export type Database = ReturnType<typeof createDb>
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export type CreateTransaction = <T>(operation: (tx: Transaction) => Promise<T>) => Promise<Result<T, Error>>
export function createCreateTransaction(db: Database): CreateTransaction {
  return async (operation) => await Result.tryCatch(db.transaction(operation))
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let Drizzle inference do the work
export function createDb({ databaseUrl }: { databaseUrl: string }) {
  return drizzle({
    connection: {
      connectionString: databaseUrl,
    },
  })
}
