import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ActionType = Enumify<typeof ActionType>
export const ActionType = {
  AGENDA: "AGENDA",
  DIRECTIVE: "DIRECTIVE",
  PROGRAM: "PROGRAM",
} as const
