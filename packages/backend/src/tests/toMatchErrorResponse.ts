import type { MatcherState, SyncMatcherResult } from "vitest"
import type { TrpcErrorResponse } from "#api/trpc.ts"

/**
 * Matches tRPC client errors by code and user message, allowing additional error data.
 */
export const errorResponseMatchers = {
  toMatchErrorResponse(this: MatcherState, received: unknown, errorResponse: TrpcErrorResponse): SyncMatcherResult {
    const expected = { data: { code: errorResponse.code }, message: errorResponse.message }

    return {
      pass: this.equals(received, expected, [...this.customTesters, this.utils.subsetEquality]),
      actual: received,
      expected,
      message: () => `expected error response to${this.isNot ? " not" : ""} match ${this.utils.printExpected(expected)}`,
    }
  },
}
