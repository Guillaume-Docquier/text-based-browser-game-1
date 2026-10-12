import type { Enumify } from "@guillaume-docquier/tools-ts"

export type CreateGameError = Enumify<typeof CreateGameError>
export const CreateGameError = {
  TOO_MANY_SEATS: "TOO_MANY_SEATS",
  INVALID_MAP_SEED: "INVALID_MAP_SEED",
  RULESET_NOT_FOUND: "RULESET_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const
