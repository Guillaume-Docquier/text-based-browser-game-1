import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"

export type LeaveGameError = Enumify<typeof LeaveGameError>
export const LeaveGameError = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  CREATOR_CANNOT_LEAVE: "CREATOR_CANNOT_LEAVE",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const LeaveGameErrorResponses: Record<LeaveGameError, { code: TRPCError["code"]; message: string }> = {
  [LeaveGameError.GAME_NOT_FOUND]: { code: "NOT_FOUND", message: "The game does not exist." },
  [LeaveGameError.GAME_ALREADY_STARTED]: { code: "CONFLICT", message: "You cannot leave a game that has already started." },
  [LeaveGameError.CREATOR_CANNOT_LEAVE]: { code: "FORBIDDEN", message: "The game creator cannot leave the lobby." },
  [LeaveGameError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game could not be left." },
}

export class LeaveGameRollbackError extends TransactionRollbackError {
  public readonly code: LeaveGameError

  public constructor(code: LeaveGameError) {
    super(code)

    this.name = "LeaveGameRollbackError"
    this.code = code
  }
}
