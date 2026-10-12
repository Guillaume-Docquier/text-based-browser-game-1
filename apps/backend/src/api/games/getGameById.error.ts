import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetGameByIdError = Enumify<typeof GetGameByIdError>
export const GetGameByIdError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const
