import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type StartGameError = Enumify<typeof StartGameError>
export const StartGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  NOT_GAME_CREATOR: "NOT_GAME_CREATOR",
  INVALID_GAME_STATUS: "INVALID_GAME_STATUS",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const StartGameErrorResponses: Record<StartGameError, { code: TRPCError["code"]; message: string }> = {
  [StartGameError.GAME_NOT_FOUND]: { code: "NOT_FOUND", message: "The game does not exist." },
  [StartGameError.NOT_GAME_CREATOR]: { code: "FORBIDDEN", message: "Only the game creator can start it." },
  [StartGameError.INVALID_GAME_STATUS]: { code: "CONFLICT", message: "The game cannot start in its current status." },
  [StartGameError.RULESET_NOT_FOUND]: { code: "INTERNAL_SERVER_ERROR", message: "Could not find the ruleset." },
  [StartGameError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game could not be started." },
}

export class StartGameRollbackError extends TransactionRollbackError {
  public readonly code: StartGameError

  public constructor(code: StartGameError) {
    super(code)

    this.name = "StartGameRollbackError"
    this.code = code
  }
}
