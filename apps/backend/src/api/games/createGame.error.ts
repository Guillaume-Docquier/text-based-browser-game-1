import type { Enumify } from "@guillaume-docquier/tools-ts"

export type CreateGameError = Enumify<typeof CreateGameError>
export const CreateGameError = {
  TOO_MANY_SEATS: "TOO_MANY_SEATS",
  INVALID_MAP_SEED: "INVALID_MAP_SEED",
  UNKNOWN: "UNKNOWN",
} as const
