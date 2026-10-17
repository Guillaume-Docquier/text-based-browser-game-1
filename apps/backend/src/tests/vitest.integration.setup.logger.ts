import type { Logger } from "@guillaume-docquier/tools-ts"
import { configureLogger } from "#lib/configureLogger.ts"

// The logger is the only side effect we have in this project (at the time of writing)
// We have set `isolate: false` in the test config, which means without this promise cache, the logger gets initialize multiple times, and it fails
// With the cache, we only initialize it once, and this module stays initialized for every test file
// The cache must be in a separate module because Vitest reruns the setup file itself, while the imported modules remain cached
let loggerPromise: Promise<Logger>

export async function configureIntegrationLogger(): Promise<Logger> {
  // nonBlocking otherwise the logs might not be flushed when the test finishes, making it hard to debug.
  // maybe not ideal because it might change the timing of things compared to prod, but for now that'll have to do.
  return await (loggerPromise ??= configureLogger({ scope: "integration-test", nonBlocking: false }))
}
