import type { ActionSource } from "#turn-processing/engine/actions/ActionSource.ts"
import type { ActionTarget } from "#turn-processing/engine/actions/ActionTarget.ts"
import type { ActionTier } from "#turn-processing/engine/actions/ActionTier.ts"
import type { ActionType } from "#turn-processing/engine/actions/ActionType.ts"
import type { Cost } from "#turn-processing/engine/actions/Cost.ts"
import type { Mechanic } from "#turn-processing/engine/mechanics/Mechanic.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinition = {
  /**
   * Unique action definition id for reference in action submissions
   */
  id: string
  type: ActionType
  tier: ActionTier
  source: ActionSource
  target: ActionTarget
  costs: Cost[]
  mechanics: Mechanic[]
}
