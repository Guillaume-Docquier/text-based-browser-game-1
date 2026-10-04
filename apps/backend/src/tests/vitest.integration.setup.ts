import { beforeAll } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"

beforeAll(async () => {
  await setupLogging()
})

async function setupLogging(): Promise<void> {
  // nonBlocking otherwise the logs might not be flushed when the test finishes, making it hard to debug.
  // maybe not ideal because it might change the timing of things compared to prod, but for now that'll have to do.
  await configureLogger({ scope: "integration-test", nonBlocking: false })
}
