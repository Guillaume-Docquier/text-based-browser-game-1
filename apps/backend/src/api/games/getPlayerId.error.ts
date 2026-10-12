import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetPlayerIdError = Enumify<typeof GetPlayerIdError>
export const GetPlayerIdError = {
  UNKNOWN: "UNKNOWN",
} as const
