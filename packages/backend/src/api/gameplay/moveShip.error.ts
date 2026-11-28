import type { TrpcErrorResponse } from "#api/trpc.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
export const MoveShipErrorResponses = {
  TURN_NOT_OPEN: { code: "CONFLICT", message: "Planning has closed for this turn." },
  SHIP_UNAVAILABLE: { code: "CONFLICT", message: "Choose a stationed ship you own with a free action." },
  DESTINATION_UNAVAILABLE: { code: "BAD_REQUEST", message: "Choose a different star or planet in this game." },
  INSUFFICIENT_CREDITS: { code: "CONFLICT", message: "Available credits do not cover the trip." },
  ORDER_NOT_FOUND: { code: "NOT_FOUND", message: "The move is no longer in your plan." },
  UNKNOWN: { code: "INTERNAL_SERVER_ERROR", message: "The movement plan could not be updated." },
} satisfies Record<string, TrpcErrorResponse>
export type MoveShipError = keyof typeof MoveShipErrorResponses
export class MoveShipRollbackError extends TransactionRollbackError {
  public readonly code: MoveShipError
  public constructor(code: MoveShipError) {
    super(code)
    this.code = code
    this.name = "MoveShipRollbackError"
  }
}
