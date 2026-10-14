import type { Enumify } from "@guillaume-docquier/tools-ts"

export type GetPlayerViewError = Enumify<typeof GetPlayerViewError>
export const GetPlayerViewError = {
  VIEW_NOT_FOUND: "VIEW_NOT_FOUND",
  UNKNOWN: "UNKNOWN",
} as const
