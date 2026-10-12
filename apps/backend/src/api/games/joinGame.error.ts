import type { Enumify } from "@guillaume-docquier/tools-ts"

export type JoinGameError = Enumify<typeof JoinGameError>
export const JoinGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  LOBBY_FULL: "LOBBY_FULL",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  UNKNOWN: "UNKNOWN",
} as const
