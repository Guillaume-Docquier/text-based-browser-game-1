import type { MaybePromise } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

declare module "vitest" {
  interface Matchers<R extends MaybePromise<void> = MaybePromise<void>, T = unknown> {
    toMatchErrorResponse: (errorResponse: TrpcErrorResponse) => R
  }
}
