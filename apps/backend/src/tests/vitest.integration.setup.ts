import { beforeAll, expect } from "vitest"
import { errorResponseMatchers } from "#tests/toMatchErrorResponse.ts"
import { configureIntegrationLogger } from "#tests/vitest.integration.setup.logger.ts"

expect.extend(errorResponseMatchers)

beforeAll(async () => {
  await configureIntegrationLogger()
})
