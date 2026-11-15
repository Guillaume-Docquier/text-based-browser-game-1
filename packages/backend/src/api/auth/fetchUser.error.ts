import type { Enumify } from "@guillaume-docquier/tools-ts"

export type FetchUserError = Enumify<typeof FetchUserError>
export const FetchUserError = {
  UNKNOWN: "UNKNOWN",
} as const
