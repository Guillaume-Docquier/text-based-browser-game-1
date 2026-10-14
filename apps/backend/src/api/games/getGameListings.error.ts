import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetGameListingsError = Enumify<typeof GetGameListingsError>
export const GetGameListingsError = {
  UNKNOWN: "UNKNOWN",
} as const
