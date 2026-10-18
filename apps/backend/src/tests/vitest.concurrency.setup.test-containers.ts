import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { POSTGRES_IMAGE } from "#tests/ConcurrencyTestApiServer.ts"

// This is leveraging `isolate: false` by putting the preload in the worker scope
// beforeAll runs before every test files, even in the same worker, so we cache the preload promise
let preloading: Promise<void>

export const TestContainers = {
  /**
   * This will download the postgres image if it's not on the system already to avoid the first test looking like it's stuck
   */
  preload: async (): Promise<void> => {
    await (preloading ??= (async (): Promise<void> => {
      const postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE).start()
      await postgresContainer.stop()
    })())
  },
  /**
   * Downloading the postgres image in CI can take a bit of time
   */
  timeoutMs: 60_000,
}
