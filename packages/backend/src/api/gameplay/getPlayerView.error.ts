import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type GetPlayerViewError = Enumify<typeof GetPlayerViewError>
export const GetPlayerViewError = {
  TURN_NOT_FOUND: "TURN_NOT_FOUND",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const GetPlayerViewErrorResponses: Record<GetPlayerViewError, TrpcErrorResponse> = {
  [GetPlayerViewError.TURN_NOT_FOUND]: { code: "NOT_FOUND", message: "No turn found for this game." },
  [GetPlayerViewError.RULESET_NOT_FOUND]: { code: "INTERNAL_SERVER_ERROR", message: "Could not find the ruleset for this game." },
  [GetPlayerViewError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Player view could not be loaded." },
}

export class GetPlayerViewRollbackError extends TransactionRollbackError {
  public readonly code: GetPlayerViewError

  public constructor(code: GetPlayerViewError) {
    super(code)

    this.name = "GetPlayerViewRollbackError"
    this.code = code
  }
}
