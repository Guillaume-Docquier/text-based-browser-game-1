import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type GameStatus = Enumify<typeof GameStatus>

/** Lifecycle status of a game. */
export const GameStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  IN_PROGRESS: "IN_PROGRESS",
  ENDED: "ENDED",
} as const

export const GameStatusSchema = z.enum(GameStatus) satisfies z.ZodType<GameStatus>
