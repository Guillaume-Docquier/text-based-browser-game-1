import type { Enumify } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type UpdateActionSubmissionError = Enumify<typeof UpdateActionSubmissionError>
export const UpdateActionSubmissionError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  PLAYER_READY: "PLAYER_READY",
  INVALID_ACTION_ID: "INVALID_ACTION_ID",
  ACTION_DEFINITION_NOT_FOUND: "ACTION_DEFINITION_NOT_FOUND",
  ACTION_IN_PROGRESS: "ACTION_IN_PROGRESS",
  INVALID_SUBMISSION: "INVALID_SUBMISSION",
  UNKNOWN: "UNKNOWN",
} as const

export class UpdateActionSubmissionRollbackError extends TransactionRollbackError {
  public readonly code: UpdateActionSubmissionError

  public constructor(code: UpdateActionSubmissionError) {
    super(code)

    this.name = "UpdateActionSubmissionRollbackError"
    this.code = code
  }
}
