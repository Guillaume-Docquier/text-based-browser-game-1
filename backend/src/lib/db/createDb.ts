import { drizzle } from "drizzle-orm/node-postgres"

export type Database = ReturnType<typeof createDb>
export type CreateTransaction = Database["transaction"]
export type Transaction = Parameters<Parameters<CreateTransaction>[0]>[0]

/**
 * Connects to the database.
 * It doesn't actually connect to the db, this happens lazily, I think. But you get a usable db reference.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let Drizzle inference do the work
export function createDb({ databaseUrl }: { databaseUrl: string }) {
  return drizzle({
    connection: {
      connectionString: databaseUrl,
      // ssl not needed for internal Railway network
      // ssl: true,
    },
  })
}
