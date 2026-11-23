import type { TrpcErrorResponse } from "#api/trpc.ts"

declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toMatchErrorResponse: (errorResponse: TrpcErrorResponse) => R
  }
}
