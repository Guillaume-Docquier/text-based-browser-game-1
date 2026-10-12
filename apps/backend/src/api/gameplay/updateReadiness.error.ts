import type { Enumify } from "@guillaume-docquier/tools-ts"

export type UpdateReadinessError = Enumify<typeof UpdateReadinessError>
export const UpdateReadinessError = {
  TURN_NOT_OPEN: "TURN_NOT_OPEN",
  UNKNOWN: "UNKNOWN",
} as const
