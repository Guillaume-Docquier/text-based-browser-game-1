import { beforeAll, expect } from "vitest"
import { prepareIntegrationTestDb } from "#tests/createIntegrationTestDb.ts"
import { errorResponseMatchers } from "#tests/toMatchErrorResponse.ts"

expect.extend(errorResponseMatchers)
beforeAll(prepareIntegrationTestDb)
