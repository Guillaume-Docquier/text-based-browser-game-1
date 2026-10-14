import type { Enumify } from "@guillaume-docquier/tools-ts"
import type { TRPCError } from "@trpc/server"

export type CreateGameError = Enumify<typeof CreateGameError>
export const CreateGameError = {
  TOO_MANY_SEATS: "TOO_MANY_SEATS",
  INVALID_MAP_SEED: "INVALID_MAP_SEED",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Maps each use-case failure to its API response code and user message.
 */
export const CreateGameErrorResponses: Record<CreateGameError, { code: TRPCError["code"]; message: string }> = {
  [CreateGameError.TOO_MANY_SEATS]: { code: "BAD_REQUEST", message: "Games cannot have that many seats." },
  [CreateGameError.INVALID_MAP_SEED]: { code: "BAD_REQUEST", message: "The selected seed is invalid." },
  [CreateGameError.UNKNOWN]: { code: "INTERNAL_SERVER_ERROR", message: "Game could not be created." },
}
