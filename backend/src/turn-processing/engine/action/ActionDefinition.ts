import type { ActionSource } from "#turn-processing/engine/action/ActionSource.ts"
import type { ActionTarget } from "#turn-processing/engine/action/ActionTarget.ts"
import type { ActionTier } from "#turn-processing/engine/action/ActionTier.ts"
import type { ActionType } from "#turn-processing/engine/action/ActionType.ts"
import type { Cost } from "#turn-processing/engine/action/Cost.ts"
import type { Effect } from "#turn-processing/engine/effects/Effect.ts"

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
  effects: Effect[]
}
