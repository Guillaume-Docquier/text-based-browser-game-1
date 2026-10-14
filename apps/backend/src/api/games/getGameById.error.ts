import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"

export type GetGameByIdError = Enumify<typeof GetGameByIdError>
export const GetGameByIdError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  FAILED_TO_GET_PLAYERS: "FAILED_TO_GET_PLAYERS",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetGameByIdErrorResponses: Record<GetGameByIdError, { code: TRPCError["code"]; message: string }> = {
  [GetGameByIdError.GAME_NOT_FOUND]: { code: "NOT_FOUND", message: "No game exists with that id." },
  [GetGameByIdError.RULESET_NOT_FOUND]: { code: "INTERNAL_SERVER_ERROR", message: "Could not find the ruleset." },
  [GetGameByIdError.FAILED_TO_GET_PLAYERS]: { code: "INTERNAL_SERVER_ERROR", message: "Could not get the players." },
  [GetGameByIdError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game details could not be loaded." },
}
