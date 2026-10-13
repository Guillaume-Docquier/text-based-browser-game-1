import type { Enumify } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type UpdateReadinessError = Enumify<typeof UpdateReadinessError>
export const UpdateReadinessError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  UNKNOWN: "UNKNOWN",
} as const

export class UpdateReadinessRollbackError extends TransactionRollbackError {
  public readonly code: UpdateReadinessError

  public constructor(code: UpdateReadinessError) {
    super(code)

    this.code = code
    this.name = "UpdateReadinessRollbackError"
  }
}
