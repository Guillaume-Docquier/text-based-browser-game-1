import { test } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"

export const concurrencyTest = test.extend("logger", { scope: "worker", auto: true }, async () => {
  // Blocking logs make failures visible before the test process exits.
  return await configureLogger({ scope: "concurrency-test", nonBlocking: false })
})
