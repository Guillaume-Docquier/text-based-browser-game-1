import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * Not every Action will implement every Tier.
 */
export type ActionTier = Enumify<typeof ActionTier>
export const ActionTier = {
  BASIC: "BASIC", // Worst
  STANDARD: "STANDARD",
  IMPROVED: "IMPROVED",
  ADVANCED: "ADVANCED",
  EXCEPTIONAL: "EXCEPTIONAL", // Best
} as const

export const ActionTierSchema = z.enum(ActionTier)
