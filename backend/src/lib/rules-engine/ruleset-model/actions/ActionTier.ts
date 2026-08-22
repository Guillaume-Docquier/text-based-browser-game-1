import type { Enumify } from "@guillaume-docquier/tools-ts"

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
