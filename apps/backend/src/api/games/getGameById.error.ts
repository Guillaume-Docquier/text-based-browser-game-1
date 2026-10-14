import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetGameByIdError = Enumify<typeof GetGameByIdError>
export const GetGameByIdError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  FAILED_TO_GET_PLAYERS: "FAILED_TO_GET_PLAYERS",
  UNKNOWN: "UNKNOWN",
} as const
