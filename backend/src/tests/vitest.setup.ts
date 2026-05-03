import { beforeAll } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"
import { pushSchema } from "drizzle-kit/api"
import * as schema from "#lib/db/schema.ts"
import { pglite } from "#tests/pglite.ts"
import { drizzle } from "drizzle-orm/pglite"

beforeAll(async () => {
  await Promise.all([setupLogging(), setupPg()])
})

async function setupLogging(): Promise<void> {
  // nonBlocking otherwise the logs might not be flushed when the test finishes, making it hard to debug.
  // maybe not ideal because it might change the timing of things compared to prod, but for now that'll have to do.
  await configureLogger({ scope: "test", nonBlocking: false })
}

/**
 * Setup that allows us to leverage {@link getPGLiteInstanceWithSchemas} to quickly create an isolated db for each test.
 * Pushing the schemas takes ~900ms, cloning is ~200ms.
 */
async function setupPg(): Promise<void> {
  const db = drizzle(pglite)
  const push = await pushSchema(schema, db)
  await push.apply()
}
