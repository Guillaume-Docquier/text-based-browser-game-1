import type { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import type { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/mechanics/Mechanic.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinition = {
  /**
   * Unique action definition id for reference in action submissions.
   */
  readonly id: string
  /**
   * Displayed in the UI.
   */
  readonly name: string
  readonly type: ActionType
  readonly tier: ActionTier
  /**
   * Target entries must match all the costs and mechanics target tags.
   * An Action will use the keys from the ActionDefinition and fill the value with the proper id.
   * self is a special key that's always present that the server will always override.
   */
  readonly targets: Readonly<{ self: "" } & Record<string, "">>
  readonly costs: readonly CostMechanic[]
  readonly mechanics: readonly Mechanic[]
}
