import type { TrpcErrorResponse } from "#api/trpc.ts"

export const TurnStateError = {
  TURN_NOT_FOUND: "TURN_NOT_FOUND",
  NOT_A_MEMBER: "NOT_A_MEMBER",
} as const

export type TurnStateError = (typeof TurnStateError)[keyof typeof TurnStateError]

export const TurnStateErrorResponses: Record<TurnStateError, TrpcErrorResponse> = {
  [TurnStateError.TURN_NOT_FOUND]: { code: "NOT_FOUND", message: "No turn was found for this game." },
  [TurnStateError.NOT_A_MEMBER]: { code: "FORBIDDEN", message: "You must join a game before you can participate in it." },
}
