import { randomUUID } from "node:crypto"
import { Assert } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { createDb, type Database } from "#lib/db/createDb.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { defineWorkerResource } from "#tests/defineWorkerResource.ts"
import { POSTGRES_IMAGE } from "#tests/POSTGRES_IMAGE.ts"
import { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"

const postgresWorker = defineWorkerResource(async (cleanup) => {
  const logger = await configureLogger({ scope: "concurrency-test", nonBlocking: false })
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
  cleanup.defer(async () => {
    await container.stop()
  })
  const connectionUri = container.getConnectionUri()
  const admin = createDb({ databaseUrl: connectionUri }).$client
  cleanup.defer(createPostgresPoolDisposal(admin))
  return { connectionUri, admin, logger }
})

export const prepareConcurrencyTestDb = postgresWorker.register

export async function createConcurrencyTestDb(): Promise<
  AsyncDisposable & { db: Database; databaseUrl: string; concurrency: PostgresConcurrency }
> {
  const { connectionUri, admin, logger } = postgresWorker.get()
  // A database per test keeps table-wide scheduling locks isolated.
  const name = `test_${randomUUID().replaceAll("-", "")}`
  await using cleanup = new AsyncDisposableStack()
  await admin.query(`CREATE DATABASE "${name}"`)
  cleanup.defer(async () => {
    await admin.query(`DROP DATABASE "${name}"`)
  })
  const url = new URL(connectionUri)
  url.pathname = `/${name}`
  const databaseUrl = url.toString()
  const db = createDb({ databaseUrl })
  cleanup.defer(createPostgresPoolDisposal(db.$client))

  await migrate(db, { migrationsFolder: "./drizzle/" })
  Assert.isSuccess(await new RulesetsRepository({ db, logger }).upsertRuleset(TestRuleset))

  const disposal = cleanup.move()
  return {
    db,
    databaseUrl,
    concurrency: new PostgresConcurrency(db.$client),
    [Symbol.asyncDispose]: disposal.disposeAsync.bind(disposal),
  }
}
