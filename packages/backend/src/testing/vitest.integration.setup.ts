import { beforeAll, expect } from "vitest"
import { prepareIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { errorResponseMatchers } from "#testing/toMatchErrorResponse.ts"

expect.extend(errorResponseMatchers)
beforeAll(prepareIntegrationTestDb)
