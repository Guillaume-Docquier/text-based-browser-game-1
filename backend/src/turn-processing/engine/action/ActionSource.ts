import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ActionSource = Enumify<typeof ActionSource>
export const ActionSource = {
  SELF: "SELF",
} as const
