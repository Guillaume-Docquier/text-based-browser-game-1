import type { Enumify } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type LeaveGameError = Enumify<typeof LeaveGameError>
export const LeaveGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  CREATOR_CANNOT_LEAVE: "CREATOR_CANNOT_LEAVE",
  UNKNOWN: "UNKNOWN",
} as const

export class LeaveGameRollbackError extends TransactionRollbackError {
  public readonly code: LeaveGameError

  public constructor(code: LeaveGameError) {
    super(code)

    this.name = "LeaveGameRollbackError"
    this.code = code
  }
}
