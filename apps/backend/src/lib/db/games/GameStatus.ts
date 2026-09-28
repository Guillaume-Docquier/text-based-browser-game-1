import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GameStatus = Enumify<typeof GameStatus>
export const GameStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  IN_PROGRESS: "IN_PROGRESS",
  ENDED: "ENDED",
} as const
