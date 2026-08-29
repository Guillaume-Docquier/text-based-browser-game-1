import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type ActionType = Enumify<typeof ActionType>
export const ActionType = {
  AGENDA: "AGENDA",
  DIRECTIVE: "DIRECTIVE",
  PROGRAM: "PROGRAM",
} as const

export const ActionTypeSchema = z.enum(ActionType)
