import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type JoinGameError = Enumify<typeof JoinGameError>
export const JoinGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  LOBBY_FULL: "LOBBY_FULL",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const JoinGameErrorResponses: Record<JoinGameError, { code: TRPCError["code"]; message: string }> = {
  [JoinGameError.GAME_NOT_FOUND]: { code: "NOT_FOUND", message: "The game does not exist." },
  [JoinGameError.LOBBY_FULL]: { code: "CONFLICT", message: "The lobby is full." },
  [JoinGameError.GAME_ALREADY_STARTED]: { code: "CONFLICT", message: "You cannot join a game that has already started." },
  [JoinGameError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game could not be joined." },
}

export class JoinGameRollbackError extends TransactionRollbackError {
  public readonly code: JoinGameError

  public constructor(code: JoinGameError) {
    super(code)

    this.name = "JoinGameRollbackError"
    this.code = code
  }
}
