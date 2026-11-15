import type { TrpcErrorResponse } from "#api/trpc.ts"

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /**
     * Checks the tRPC client's error code and user message against a mapped response.
     */
    toMatchErrorResponse: (errorResponse: TrpcErrorResponse) => R
  }
}
