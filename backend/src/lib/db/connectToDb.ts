import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"

/**
 * Connects to the database.
 * It doesn't actually connect to the db, this happens lazily, I think. But you get a usable db reference.
 */
export function connectToDb({ databaseUrl }: { databaseUrl: string }): NodePgDatabase {
  return drizzle({
    connection: {
      connectionString: databaseUrl,
      // I probably want ssl?
      // ssl: true,
    },
  })
}
