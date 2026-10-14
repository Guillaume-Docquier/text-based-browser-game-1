import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

export type GetPlayerViewError = Enumify<typeof GetPlayerViewError>
export const GetPlayerViewError = {
  VIEW_NOT_FOUND: "VIEW_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetPlayerViewErrorResponses: Record<GetPlayerViewError, TrpcErrorResponse> = {
  [GetPlayerViewError.VIEW_NOT_FOUND]: { code: "NOT_FOUND", message: "Player view could not be found." },
  [GetPlayerViewError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Player view could not be loaded." },
}
