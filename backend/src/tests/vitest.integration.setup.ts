import { Logger } from "@guillaume-docquier/tools-ts"
import { pushSchema } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { beforeAll } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"
import type { Database } from "#lib/db/createDb.ts"
import * as schema from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { TestRuleset } from "#lib/rulesets/test/TestRuleset.ts"
import { pglite } from "#tests/pglite.ts"

beforeAll(async () => {
  await Promise.all([setupLogging(), setupPg()])
})

async function setupLogging(): Promise<void> {
  // nonBlocking otherwise the logs might not be flushed when the test finishes, making it hard to debug.
  // maybe not ideal because it might change the timing of things compared to prod, but for now that'll have to do.
  await configureLogger({ scope: "integration-test", nonBlocking: false })
}

/**
 * Setup that allows us to leverage {@link getPGLiteInstanceWithSchemas} to quickly create an isolated db for each test.
 * Pushing the schemas takes ~900ms, cloning is ~200ms.
 */
async function setupPg(): Promise<void> {
  // TS2375: Type
  // PgliteDatabase<Record<string, never>> & {
  //   $client: PGlite;
  // }
  // is not assignable to type Database<Record<string, never>> with 'exactOptionalPropertyTypes: true'.
  // Consider adding undefined to the types of the target's properties.
  //
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- In reality the types work, and this is for testing, so if it doesn't work, it should be obvious.
  const db = drizzle(pglite) as unknown as Database

  const push = await pushSchema(schema, db)
  await push.apply()

  // We push the test ruleset in the main db copy, so all tests can use it afterward.
  // Core ruleset are pre-seeded data in production, so this replicates what we expect in production, but we only upsert the test ruleset for speed.
  const rulesetRepository = new RulesetsRepository({ db, logger: Logger.get() })
  await rulesetRepository.upsertRuleset(TestRuleset)
}
