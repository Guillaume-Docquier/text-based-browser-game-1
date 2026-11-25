import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

export type TurnStateError = Enumify<typeof TurnStateError>
export const TurnStateError = {
  TURN_NOT_FOUND: "TURN_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

export const TurnStateErrorResponses: Record<TurnStateError, TrpcErrorResponse> = {
  [TurnStateError.TURN_NOT_FOUND]: { code: "NOT_FOUND", message: "No turn found for this game." },
  [TurnStateError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Turn state could not be loaded." },
}
