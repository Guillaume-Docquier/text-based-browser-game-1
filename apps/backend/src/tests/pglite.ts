import { AsyncLocalStorage } from "node:async_hooks"
import { PGlite } from "@electric-sql/pglite"
import { Assert } from "@guillaume-docquier/tools-ts"

const templates = new AsyncLocalStorage<PGlite>()
const testDatabases = new AsyncLocalStorage<AsyncDisposableStack>()

/**
 * Owns the schema template for one integration file, including cleanup if setup fails.
 * The callback prepares the template before running the file's tests.
 */
export async function withPGLiteTemplate(runSuite: (template: PGlite) => Promise<void>): Promise<void> {
  await using resources = new AsyncDisposableStack()
  const template = new PGlite()
  resources.defer(async () => {
    await template.close()
  })
  await templates.run(template, runSuite, template)
}

/**
 * Owns all database clones allocated during one test, including setup and teardown hooks.
 * Async context keeps concurrent tests' resource owners separate.
 */
export async function withTestDatabases<T>(runTest: () => Promise<T>): Promise<T> {
  await using resources = new AsyncDisposableStack()
  return await testDatabases.run(resources, runTest)
}

/**
 * Clones the prepared template and registers the clone with the current test's owner.
 * Integration fixtures await cleanup automatically, including after failed tests.
 * Consumers borrow the database and must stop before the test's teardown finishes.
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
  const template = templates.getStore()
  const resources = testDatabases.getStore()
  Assert.isDefined(template)
  Assert.isDefined(resources)
  Assert.isTrue(!resources.disposed)

  const allocation = template.clone()
  resources.defer(async () => {
    // Allocation failures are reported to the caller; teardown has no database to close.
    const pg = await allocation.catch(() => undefined)
    if (pg !== undefined) {
      await pg.close()
    }
  })

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clone returns the same PGlite implementation, but the library's clone type omits part of the public instance type
  return (await allocation) as PGlite
}
