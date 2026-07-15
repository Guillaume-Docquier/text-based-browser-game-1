import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GamePlayerActionType = Enumify<typeof GamePlayerActionType>
export const GamePlayerActionType = {
  MAKE_MORE_MONEY: "MAKE_MORE_MONEY",
  WIN_THE_GAME: "WIN_THE_GAME",
  BUILD_UNIT: "BUILD_UNIT",
} as const
