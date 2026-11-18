import { PGlite } from "@electric-sql/pglite"
import { Assert } from "@guillaume-docquier/tools-ts"
import { pushSchema } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import type { Database } from "#lib/db/createDb.ts"
import * as schema from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

// This is leveraging `isolate: false` by putting the preload in the worker scope
// beforeAll runs before every test files, even in the same worker, so we cache the template
let loadDataDir: Blob

export async function prepareIntegrationTestDb(): Promise<void> {
  if (loadDataDir !== undefined) {
    // beforeAll gets called multiple times in the same isolate, but we only need to initialize once
    return
  }

  // Blocking logs make failures visible before the test process exits.
  const logger = await configureLogger({ scope: "integration-test", nonBlocking: false })

  await using pgliteTemplate = new PGlite()

  const db = pgliteToDb(pgliteTemplate)
  const push = await pushSchema(schema, db)
  await push.apply()

  // We push the test ruleset in the main db copy, so all tests can use it afterward.
  // Core ruleset are pre-seeded data in production, so this replicates what we expect in production, but we only upsert the test ruleset for speed.
  const rulesetRepository = new RulesetsRepository({ db, logger })
  await rulesetRepository.upsertRuleset(TestRuleset)

  loadDataDir = await pgliteTemplate.dumpDataDir("none")
}

export async function createIntegrationTestDb(): Promise<Database & AsyncDisposable> {
  Assert.isDefined(loadDataDir)

  const pgliteClone = await PGlite.create({ loadDataDir })
  return Object.assign(pgliteToDb(pgliteClone), { [Symbol.asyncDispose]: pgliteClone.close.bind(pgliteClone) })
}

function pgliteToDb(pglite: PGlite): Database {
  // TS2375: Type
  // PgliteDatabase<Record<string, never>> & {
  //   $client: PGlite;
  // }
  // is not assignable to type Database<Record<string, never>> with 'exactOptionalPropertyTypes: true'.
  // Consider adding undefined to the types of the target's properties.
  //
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- In reality the types work, and this is for testing, so if it doesn't work, it should be obvious.
  return drizzle(pglite) as unknown as Database
}
