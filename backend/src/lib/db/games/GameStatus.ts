import type { Enumify } from "@guillaume-docquier/tools-ts"
import { pgEnum } from "drizzle-orm/pg-core"
import { pgEnumify } from "#lib/db/pgEnumify.ts"

export type GameStatus = Enumify<typeof GameStatus>
export const GameStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  COLLECTING_ACTIONS: "COLLECTING_ACTIONS",
  PROCESSING_TURN: "PROCESSING_TURN",
  ENDED: "ENDED",
} as const

export const gameStatusColumn = pgEnum("game_status", pgEnumify(GameStatus))
