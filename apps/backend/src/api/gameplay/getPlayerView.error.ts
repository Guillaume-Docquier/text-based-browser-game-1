import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"

export type GetPlayerViewError = Enumify<typeof GetPlayerViewError>
export const GetPlayerViewError = {
  VIEW_NOT_FOUND: "VIEW_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetPlayerViewErrorResponses: Record<GetPlayerViewError, { code: TRPCError["code"]; message: string }> = {
  [GetPlayerViewError.VIEW_NOT_FOUND]: { code: "NOT_FOUND", message: "Player view could not be found." },
  [GetPlayerViewError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Player view could not be loaded." },
}
