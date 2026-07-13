import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { beforeAll } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"
import { POSTGRES_IMAGE } from "#tests/ConcurrencyTestApiServer.ts"

beforeAll(async () => {
  await Promise.all([setupLogging(), preloadPostgres()])
  // Downloading the postgres image in CI can take some time
}, 60_000)

async function setupLogging(): Promise<void> {
  // nonBlocking otherwise the logs might not be flushed when the test finishes, making it hard to debug.
  // maybe not ideal because it might change the timing of things compared to prod, but for now that'll have to do.
  await configureLogger({ scope: "concurrency-test", nonBlocking: false })
}

/**
 * This will download the postgres image if it's not on the system already to avoid the first test looking like it's stuck
 */
async function preloadPostgres(): Promise<void> {
  const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
  await postgresContainer.stop()
}
