import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ActionType = Enumify<typeof ActionType>
export const ActionType = {
  MAKE_MORE_MONEY: "MAKE_MORE_MONEY",
  WIN_THE_GAME: "WIN_THE_GAME",
} as const
