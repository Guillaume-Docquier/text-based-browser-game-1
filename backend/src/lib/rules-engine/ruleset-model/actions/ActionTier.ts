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

export const ActionTierRank = {
  [ActionTier.BASIC]: 1, // Worst
  [ActionTier.STANDARD]: 2,
  [ActionTier.IMPROVED]: 3,
  [ActionTier.ADVANCED]: 4,
  [ActionTier.EXCEPTIONAL]: 5, // Best
} as const satisfies Record<ActionTier, number>
