import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { SubmittedActionIssue } from "shared/action-submission/validation/SubmittedActionIssue.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type UpdateActionSubmissionError = Enumify<typeof UpdateActionSubmissionError>
export const UpdateActionSubmissionError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  PLAYER_READY: "PLAYER_READY",
  INVALID_ACTION_ID: "INVALID_ACTION_ID",
  INVALID_TARGETS: "INVALID_TARGETS",
  INSUFFICIENT_RESOURCES: "INSUFFICIENT_RESOURCES",
  UNKNOWN: "UNKNOWN",
} as const

export type UpdateActionSubmissionFailure =
  | Readonly<{ type: Exclude<UpdateActionSubmissionError, "INVALID_TARGETS" | "INSUFFICIENT_RESOURCES"> }>
  | Readonly<{ type: "INVALID_TARGETS" | "INSUFFICIENT_RESOURCES"; issues: readonly SubmittedActionIssue[] }>

/**
 * Aborts submission writes while preserving a typed rejection and validation details.
 */
export class UpdateActionSubmissionRollbackError extends TransactionRollbackError {
  public readonly failure: UpdateActionSubmissionFailure

  public constructor(failure: UpdateActionSubmissionFailure) {
    super("Action submission rejected", { cause: failure })
    this.name = "UpdateActionSubmissionRollbackError"
    this.failure = failure
  }
}
