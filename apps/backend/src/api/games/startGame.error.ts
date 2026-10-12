import type { Enumify } from "@guillaume-docquier/tools-ts"

export type StartGameError = Enumify<typeof StartGameError>
export const StartGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  NOT_GAME_CREATOR: "NOT_GAME_CREATOR",
  INVALID_GAME_STATUS: "INVALID_GAME_STATUS",
  UNKNOWN: "UNKNOWN",
} as const
