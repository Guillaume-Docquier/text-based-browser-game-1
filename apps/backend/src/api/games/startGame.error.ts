import type { Enumify } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type StartGameError = Enumify<typeof StartGameError>
export const StartGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  NOT_GAME_CREATOR: "NOT_GAME_CREATOR",
  INVALID_GAME_STATUS: "INVALID_GAME_STATUS",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

export class StartGameRollbackError extends TransactionRollbackError {
  public readonly code: StartGameError

  public constructor(code: StartGameError) {
    super(code)

    this.name = "StartGameRollbackError"
    this.code = code
  }
}
