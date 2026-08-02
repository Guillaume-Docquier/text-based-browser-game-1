import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GameStatus = Enumify<typeof GameStatus>
export const GameStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  COLLECTING_ORDERS: "COLLECTING_ORDERS",
  PROCESSING_TURN: "PROCESSING_TURN",
  ENDED: "ENDED",
} as const
