/**
 * An engine-owned, ordered stage of Turn Resolution.
 */
export type Phase = (typeof Phase)[keyof typeof Phase]
export const Phase = {
  PAY_COSTS: "PAY_COSTS",
  TRAVEL: "TRAVEL",
  COMBAT: "COMBAT",
  GOVERNANCE: "GOVERNANCE",
  INCOME: "INCOME",
  COLONIZATION: "COLONIZATION",
  CHECK_VICTORY: "CHECK_VICTORY",
} as const

/**
 * The fixed order in which the engine resolves Phases.
 */
export const PHASE_ORDER: readonly Phase[] = [
  Phase.PAY_COSTS,
  Phase.TRAVEL,
  Phase.COMBAT,
  Phase.GOVERNANCE,
  Phase.INCOME,
  Phase.COLONIZATION,
  Phase.CHECK_VICTORY,
]
