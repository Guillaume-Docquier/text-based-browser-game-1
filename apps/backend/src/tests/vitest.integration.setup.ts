import { expect } from "vitest"
import { errorResponseMatchers } from "#tests/toMatchErrorResponse.ts"

expect.extend(errorResponseMatchers)
