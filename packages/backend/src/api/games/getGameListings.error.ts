import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

export type GetGameListingsError = Enumify<typeof GetGameListingsError>
export const GetGameListingsError = {
  UNKNOWN: "UNKNOWN",
} as const

export const GetGameListingsErrorResponses: Record<GetGameListingsError, TrpcErrorResponse> = {
  [GetGameListingsError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game listings could not be loaded." },
}
