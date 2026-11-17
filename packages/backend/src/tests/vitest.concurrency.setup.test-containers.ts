import { PostgreSqlContainer } from "@testcontainers/postgresql"

// Keep aligned with production and infra/docker-compose.yaml.
export const POSTGRES_IMAGE = "postgres:18.4"

// With isolate: false, cache the preload across test files in the same worker.
let preloading: Promise<void> | undefined

export const TestContainers = {
  /** Download missing images before test timing starts. */
  preload: async (): Promise<void> => {
    await (preloading ??= (async (): Promise<void> => {
      const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
      await postgresContainer.stop()
    })())
  },
  // Image downloads in CI have a separate timeout from the tests.
  timeoutMs: 60_000,
}
