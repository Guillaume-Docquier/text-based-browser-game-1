import { PGlite } from "@electric-sql/pglite"
import { Logger } from "@guillaume-docquier/tools-ts"
import { pushSchema } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { test } from "vitest"
import type { Database } from "#lib/db/createDb.ts"
import * as schema from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

export const integrationTest = test
  /**
   * Creates a db template with the schema applied and seeded data for the worker scope.
   * Use the db fixture to get an isolated copy for your test.
   * This is much faster than pushing the schemas every time.
   */
  .extend("pgliteTemplate", { scope: "worker" }, async () => {
    const pgliteTemplate = new PGlite()

    const db = pgliteToDb(pgliteTemplate)
    const push = await pushSchema(schema, db)
    await push.apply()

    // We push the test ruleset in the main db copy, so all tests can use it afterward.
    // Core ruleset are pre-seeded data in production, so this replicates what we expect in production, but we only upsert the test ruleset for speed.
    const rulesetRepository = new RulesetsRepository({ db, logger: Logger.get() })
    await rulesetRepository.upsertRuleset(TestRuleset)

    return pgliteTemplate
  })
  /**
   * Clones the pgliteTemplate to get an isolated database ready to use.
   */
  .extend("db", async ({ pgliteTemplate }, { onCleanup }) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clone returns the same PGlite implementation, but the library's clone type omits part of the public instance type
    const pgliteClone = (await pgliteTemplate.clone()) as PGlite
    const db = pgliteToDb(pgliteClone)
    onCleanup(async () => {
      await pgliteClone.close()
    })

    return db
  })

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
