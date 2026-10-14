import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"

export type GetGameListingsError = Enumify<typeof GetGameListingsError>
export const GetGameListingsError = {
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetGameListingsErrorResponses: Record<GetGameListingsError, { code: TRPCError["code"]; message: string }> = {
  [GetGameListingsError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game listings could not be loaded." },
}
