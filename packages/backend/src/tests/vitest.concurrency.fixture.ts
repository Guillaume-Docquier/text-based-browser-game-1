import { randomUUID } from "node:crypto"
import { Assert } from "@guillaume-docquier/tools-ts"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { test } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"
import { createDb } from "#lib/db/createDb.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"

// Keep aligned with production and infra/docker-compose.yaml.
const POSTGRES_IMAGE = "postgres:18.4"

export const concurrencyTest = test
  .extend("logger", { scope: "worker", auto: true }, async () => {
    return await configureLogger({ scope: "concurrency-test", nonBlocking: false })
  })
  .extend("postgres", { scope: "worker" }, async ({ logger: _logger }, { onCleanup }) => {
    const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
    const admin = createDb({ databaseUrl: container.getConnectionUri() })
    onCleanup(async () => {
      await admin.$client.end()
      await container.stop()
    })
    return { container, admin }
  })
  .extend("postgresDatabase", async ({ postgres, logger }, { onCleanup }) => {
    // A database per test permits table-wide scheduling locks without cross-test interference.
    const databaseName = `test_${randomUUID().replaceAll("-", "")}`
    await postgres.admin.$client.query(`CREATE DATABASE "${databaseName}"`)
    const databaseUrl = new URL(postgres.container.getConnectionUri())
    databaseUrl.pathname = `/${databaseName}`
    const db = createDb({ databaseUrl: databaseUrl.toString() })
    onCleanup(async () => {
      await db.$client.end()
      await postgres.admin.$client.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    })
    await migrate(db, { migrationsFolder: "./drizzle/" })
    const rulesetsRepository = new RulesetsRepository({ db, logger })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(TestRuleset))

    return { db, databaseUrl: databaseUrl.toString(), concurrency: new PostgresConcurrency(db.$client) }
  })
