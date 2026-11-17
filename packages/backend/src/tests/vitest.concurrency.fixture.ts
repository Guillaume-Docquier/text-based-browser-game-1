import { randomUUID } from "node:crypto"
import { Assert } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { test } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"
import { createDb } from "#lib/db/createDb.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { POSTGRES_IMAGE } from "#tests/POSTGRES_IMAGE.ts"
import { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"

export const concurrencyTest = test
  .extend("logger", { scope: "worker", auto: true }, async () => {
    return await configureLogger({ scope: "concurrency-test", nonBlocking: false })
  })
  .extend("postgresInternal", { scope: "worker" }, async ({ logger: _logger }, { onCleanup }) => {
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()

    const adminDb = createDb({ databaseUrl: container.getConnectionUri() })
    const closeAdminPool = createPostgresPoolDisposal(adminDb.$client)
    onCleanup(async () => {
      await closeAdminPool()
      await container.stop()
    })

    return {
      container,
      createSqlDb: async (dbName: string): Promise<() => Promise<void>> => {
        await adminDb.$client.query(`CREATE DATABASE "${dbName}"`)

        return async () => {
          await adminDb.$client.query(`DROP DATABASE "${dbName}"`)
        }
      },
    }
  })
  .extend("postgres", async ({ postgresInternal, logger }, { onCleanup }) => {
    // A database per test permits table-wide scheduling locks without cross-test interference.
    const databaseName = `test_${randomUUID().replaceAll("-", "")}`
    const dropSqlDb = await postgresInternal.createSqlDb(databaseName)

    const databaseUrl = new URL(postgresInternal.container.getConnectionUri())
    databaseUrl.pathname = `/${databaseName}`

    const db = createDb({ databaseUrl: databaseUrl.toString() })
    const closePool = createPostgresPoolDisposal(db.$client)
    onCleanup(async () => {
      await closePool()
      await dropSqlDb()
    })

    await migrate(db, { migrationsFolder: "./drizzle/" })
    const rulesetsRepository = new RulesetsRepository({ db, logger })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(TestRuleset))

    return {
      db,
      databaseUrl: databaseUrl.toString(),
      concurrency: new PostgresConcurrency(db.$client),
    }
  })
