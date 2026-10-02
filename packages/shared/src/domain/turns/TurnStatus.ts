import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type TurnStatus = Enumify<typeof TurnStatus>

/** Lifecycle status of a game turn and its processing job. */
export const TurnStatus = {
  COLLECTING_ACTIONS: "COLLECTING_ACTIONS",
  AWAITING_PROCESSING: "AWAITING_PROCESSING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
} as const

export const TurnStatusSchema = z.enum(TurnStatus) satisfies z.ZodType<TurnStatus>
