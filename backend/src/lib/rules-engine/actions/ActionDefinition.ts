import type { ActionSource } from "#lib/rules-engine/actions/ActionSource.ts"
import type { ActionTarget } from "#lib/rules-engine/actions/ActionTarget.ts"
import type { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import type { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinition = {
  /**
   * Unique action definition id for reference in action submissions
   */
  id: string
  /**
   * Displayed in the UI
   */
  name: string
  type: ActionType
  tier: ActionTier
  source: ActionSource
  target: ActionTarget
  costs: CostMechanic[]
  mechanics: Mechanic[]
}
