import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type UpdateReadinessError = Enumify<typeof UpdateReadinessError>
export const UpdateReadinessError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const UpdateReadinessErrorResponses: Record<UpdateReadinessError, { code: TRPCError["code"]; message: string }> = {
  [UpdateReadinessError.TURN_NOT_OPEN]: { code: "CONFLICT", message: "Readiness cannot be changed: the turn is not open." },
  [UpdateReadinessError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Readiness could not be updated." },
}

export class UpdateReadinessRollbackError extends TransactionRollbackError {
  public readonly code: UpdateReadinessError

  public constructor(code: UpdateReadinessError) {
    super(code)

    this.code = code
    this.name = "UpdateReadinessRollbackError"
  }
}
