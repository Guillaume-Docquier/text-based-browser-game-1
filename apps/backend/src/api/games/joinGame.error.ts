import type { Enumify } from "@guillaume-docquier/tools-ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type JoinGameError = Enumify<typeof JoinGameError>
export const JoinGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  LOBBY_FULL: "LOBBY_FULL",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  UNKNOWN: "UNKNOWN",
} as const

export class JoinGameRollbackError extends TransactionRollbackError {
  public readonly code: JoinGameError

  public constructor(code: JoinGameError) {
    super(code)

    this.name = "JoinGameRollbackError"
    this.code = code
  }
}
