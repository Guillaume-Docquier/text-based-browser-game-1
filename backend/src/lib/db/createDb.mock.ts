import { type NodePgDatabase } from "drizzle-orm/node-postgres"
import { drizzle } from "drizzle-orm/pglite"
import { getPGLiteInstanceWithSchemas } from "#tests/pglite.ts"

/**
 * Creates an in-memory Postgres database using PGLite.
 * The db will have all the tables ready, but no data.
 */
export async function createDbMock(): Promise<NodePgDatabase> {
  const pg = await getPGLiteInstanceWithSchemas()
  const db = drizzle(pg)

  // TS2375: Type
  // PgliteDatabase<Record<string, never>> & {
  //   $client: PGlite;
  // }
  // is not assignable to type NodePgDatabase<Record<string, never>> with 'exactOptionalPropertyTypes: true'.
  // Consider adding undefined to the types of the target's properties.
  //
  // In reality the types work, and this is for testing, so if it doesn't work, it should be obvious.
  return db as unknown as NodePgDatabase
}
