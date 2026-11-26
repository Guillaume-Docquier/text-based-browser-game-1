import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"

export type GetTurnStateError = Enumify<typeof GetTurnStateError>
export const GetTurnStateError = {
  TURN_NOT_FOUND: "TURN_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

export const GetTurnStateErrorResponses: Record<GetTurnStateError, TrpcErrorResponse> = {
  [GetTurnStateError.TURN_NOT_FOUND]: { code: "NOT_FOUND", message: "No turn found for this game." },
  [GetTurnStateError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Turn state could not be loaded." },
}
