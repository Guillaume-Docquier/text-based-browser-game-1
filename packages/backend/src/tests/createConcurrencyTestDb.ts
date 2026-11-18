import { randomUUID } from "node:crypto"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { Pool } from "pg"
import { configureLogger } from "#lib/configureLogger.ts"
import { createDb, type Database } from "#lib/db/createDb.ts"
import { createPostgresPoolDisposal } from "#tests/createPostgresPoolDisposal.ts"
import { POSTGRES_IMAGE } from "#tests/POSTGRES_IMAGE.ts"
import { PostgresConcurrency } from "#tests/PostgresConcurrency.ts"

// This is leveraging `isolate: false` by putting the preload in the worker scope
// beforeAll runs before every test files, even in the same worker, so we cache the container
let connectionUri: string

export async function prepareConcurrencyTestDb(): Promise<void> {
  if (connectionUri !== undefined) {
    // beforeAll gets called multiple times in the same isolate, but we only need to initialize once
    return
  }

  // Blocking logs make failures visible before the test process exits.
  await configureLogger({ scope: "concurrency-test", nonBlocking: false })

  // This will download the Postgres image if it's not on the system already to avoid the first test looking like it's stuck
  // On the CI, this can take >30s
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()

  connectionUri = container.getConnectionUri()
}

export async function createConcurrencyTestDb(): Promise<
  AsyncDisposable & { db: Database; databaseUrl: string; concurrency: PostgresConcurrency }
> {
  const adminPool = createDb({ databaseUrl: connectionUri }).$client
  const cleanupAdminPool = createPostgresPoolDisposal(adminPool)

  // A database per test keeps table-wide scheduling locks isolated.
  const databaseName = `test_${randomUUID().replaceAll("-", "")}`
  const cleanupSqlDb = await createSqlDb(adminPool, databaseName)

  const url = new URL(connectionUri)
  url.pathname = `/${databaseName}`
  const databaseUrl = url.toString()

  const db = createDb({ databaseUrl })
  const cleanupDbPool = createPostgresPoolDisposal(db.$client)

  await migrate(db, { migrationsFolder: "./drizzle/" })

  return {
    db,
    databaseUrl,
    concurrency: new PostgresConcurrency(db.$client),
    [Symbol.asyncDispose]: async () => {
      await cleanupDbPool()
      await cleanupSqlDb()
      await cleanupAdminPool()
    },
  }
}

async function createSqlDb(adminPool: Pool, dbName: string): Promise<() => Promise<void>> {
  await adminPool.query(`CREATE DATABASE "${dbName}"`)

  return async () => {
    await adminPool.query(`DROP DATABASE "${dbName}"`)
  }
}
