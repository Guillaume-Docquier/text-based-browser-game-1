import { PGlite } from "@electric-sql/pglite"
import { Assert } from "@guillaume-docquier/tools-ts"
import { pushSchema } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import type { Database } from "#lib/db/createDb.ts"
import * as schema from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { defineWorkerResource } from "#tests/defineWorkerResource.ts"

const template = defineWorkerResource(async (cleanup) => {
  const logger = await configureLogger({ scope: "integration-test", nonBlocking: false })
  const pglite = new PGlite()
  cleanup.defer(async () => {
    await pglite.close()
  })
  const db = pgliteToDb(pglite)
  const push = await pushSchema(schema, db)
  await push.apply()
  Assert.isSuccess(await new RulesetsRepository({ db, logger }).upsertRuleset(TestRuleset))
  return pglite
})

export const prepareIntegrationTestDb = template.register

export async function createIntegrationTestDb(): Promise<Database & AsyncDisposable> {
  const clone = await template.get().clone()
  Assert.isTrue(clone instanceof PGlite)
  return Object.assign(pgliteToDb(clone), { [Symbol.asyncDispose]: clone.close.bind(clone) })
}

function pgliteToDb(pglite: PGlite): Database {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The integration tests exercise our node-postgres queries through the PGlite driver.
  return drizzle(pglite) as unknown as Database
}
