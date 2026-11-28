import type { TrpcErrorResponse } from "#api/trpc.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export const ConstructionErrorResponses = {
  TURN_NOT_OPEN: { code: "CONFLICT", message: "Planning has closed for this turn." },
  NO_COMMAND_CENTER: { code: "FORBIDDEN", message: "Construction requires a command center on a planet you own." },
  CENTER_RESERVED: { code: "CONFLICT", message: "This command center already has a construction order." },
  SITE_UNAVAILABLE: { code: "CONFLICT", message: "Select an empty surface hex." },
  INSUFFICIENT_CREDITS: { code: "CONFLICT", message: "Available credits do not cover this construction." },
  ORDER_NOT_FOUND: { code: "NOT_FOUND", message: "The construction order is no longer in your plan." },
  UNKNOWN: { code: "INTERNAL_SERVER_ERROR", message: "The construction plan could not be updated." },
} satisfies Record<string, TrpcErrorResponse>
export type ConstructionError = keyof typeof ConstructionErrorResponses

export class ConstructionRollbackError extends TransactionRollbackError {
  public readonly code: ConstructionError
  public constructor(code: ConstructionError) {
    super(code)
    this.code = code
    this.name = "ConstructionRollbackError"
  }
}
