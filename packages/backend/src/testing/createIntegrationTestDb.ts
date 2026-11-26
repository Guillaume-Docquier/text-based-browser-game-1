import { readdir, readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { Assert } from "@guillaume-docquier/tools-ts"
import { pushSchema } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { configureLogger } from "#lib/configureLogger.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { NotificationListener } from "#lib/db/PostgresNotificationListener.ts"
// oxlint-disable-next-line import/no-namespace -- Drizzle Kit needs the complete schema for pushSchema.
import * as schema from "#lib/db/schema.ts"

// CONSTRAINT: We leverage `isolate: false` to set up only once.
let loadDataDir: Blob

export async function prepareIntegrationTestDb(): Promise<void> {
  if (loadDataDir !== undefined) {
    // CONSTRAINT: beforeAll gets called multiple times in the same isolate, but we only need to initialize once.
    return
  }

  // CONSTRAINT: Blocking logs make failures visible before the test process exits.
  await configureLogger({ scope: "integration-test", nonBlocking: false })

  await using pgliteTemplate = new PGlite()

  const db = pgliteToDb(pgliteTemplate)
  const push = await pushSchema(schema, db)
  await push.apply()
  await applyCustomMigrations(pgliteTemplate)

  loadDataDir = await pgliteTemplate.dumpDataDir("none")
}

export async function createIntegrationTestDb(): Promise<Database & AsyncDisposable & { notificationListener: NotificationListener }> {
  Assert.isDefined(loadDataDir)

  const pgliteClone = await PGlite.create({ loadDataDir })
  const notificationListener: NotificationListener = {
    listen(channel, { onPayload, onReady }) {
      void pgliteClone.listen(channel, onPayload).then(onReady)
    },
  }
  return Object.assign(pgliteToDb(pgliteClone), { notificationListener, [Symbol.asyncDispose]: pgliteClone.close.bind(pgliteClone) })
}

async function applyCustomMigrations(pglite: PGlite): Promise<void> {
  const migrationsDirectory = new URL("../../migrations/", import.meta.url)
  const migrations = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort()
  for (const migration of migrations) {
    await pglite.exec(await readFile(new URL(migration, migrationsDirectory), "utf8"))
  }
}

function pgliteToDb(pglite: PGlite): Database {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- In reality the types work, and this is for testing, so if it doesn't work, it should be obvious.
  return drizzle(pglite) as unknown as Database
}
