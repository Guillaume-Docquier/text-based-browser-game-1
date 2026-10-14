import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TrpcErrorResponse } from "#api/trpc.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type UpdateActionSubmissionError = Enumify<typeof UpdateActionSubmissionError>
export const UpdateActionSubmissionError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  PLAYER_READY: "PLAYER_READY",
  INVALID_ACTION_ID: "INVALID_ACTION_ID",
  ACTION_DEFINITION_NOT_FOUND: "ACTION_DEFINITION_NOT_FOUND",
  INVALID_SUBMISSION: "INVALID_SUBMISSION",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const UpdateActionSubmissionErrorResponses: Record<UpdateActionSubmissionError, TrpcErrorResponse> = {
  [UpdateActionSubmissionError.TURN_NOT_OPEN]: { code: "CONFLICT", message: "Actions cannot be changed: the turn is not open." },
  [UpdateActionSubmissionError.PLAYER_READY]: { code: "CONFLICT", message: "You must cancel readiness before changing actions." },
  [UpdateActionSubmissionError.INVALID_ACTION_ID]: { code: "BAD_REQUEST", message: "This action is not available." },
  [UpdateActionSubmissionError.ACTION_DEFINITION_NOT_FOUND]: {
    code: "BAD_REQUEST",
    message: "Could not find a definition for this action.",
  },
  [UpdateActionSubmissionError.INVALID_SUBMISSION]: {
    code: "BAD_REQUEST",
    message: "Invalid action submission, targets are invalid or costs cannot be paid.",
  },
  [UpdateActionSubmissionError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Action submission could not be updated." },
}

export class UpdateActionSubmissionRollbackError extends TransactionRollbackError {
  public readonly code: UpdateActionSubmissionError

  public constructor(code: UpdateActionSubmissionError) {
    super(code)

    this.name = "UpdateActionSubmissionRollbackError"
    this.code = code
  }
}
