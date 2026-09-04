import type { Enumify } from "@guillaume-docquier/tools-ts"

export type TurnStatus = Enumify<typeof TurnStatus>
export const TurnStatus = {
  COLLECTING_ACTIONS: "COLLECTING_ACTIONS",
  AWAITING_PROCESSING: "AWAITING_PROCESSING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
} as const
