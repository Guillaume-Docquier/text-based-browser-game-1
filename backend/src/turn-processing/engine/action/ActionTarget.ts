import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ActionTarget = Enumify<typeof ActionTarget>
export const ActionTarget = {
  SELF: "SELF",
} as const
