import { beforeAll } from "vitest"
import { configureLogger } from "#lib/configureLogger.ts"

beforeAll(async () => {
  await configureLogger({ scope: "test", nonBlocking: false })
})
