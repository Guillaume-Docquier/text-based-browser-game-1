import { PGlite } from "@electric-sql/pglite"

/**
 * The pglite instance for this worker. You should not be using this directly. This is for the vitest setup only.
 * Use {@link getPGLiteInstanceWithSchemas} instead.
 */
export const pglite = new PGlite()

/**
 * Tests will create a pglite instance with schemas already pushed.
 * Use `getPGLiteInstanceWithSchemas` to get a clone of it to create a fresh db.
 * This is much faster than pushing the schemas every time.
 *
 * @example
 * ```ts
 * import { drizzle } from "drizzle-orm/pglite"
 * import { getPGLiteInstanceWithSchemas } from "#tests/pglite.ts"
 *
 * const pg = await getPGLiteInstanceWithSchemas()
 * const db = drizzle(pg)
 * ```
 */
export async function getPGLiteInstanceWithSchemas(): Promise<PGlite> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clone returns the same PGlite implementation, but the library's clone type omits part of the public instance type
  return (await pglite.clone()) as PGlite
}
