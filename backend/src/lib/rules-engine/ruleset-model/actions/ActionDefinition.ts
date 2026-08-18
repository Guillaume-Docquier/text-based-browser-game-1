import type { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import type { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import type { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import type { Mechanic } from "#lib/rules-engine/ruleset-model/mechanics/Mechanic.ts"

/**
 * The definition of an Action.
 */
export type ActionDefinition = Readonly<{
  /**
   * Unique action definition id for reference in action submissions.
   */
  id: string
  /**
   * Displayed in the UI.
   */
  name: string
  type: ActionType
  tier: ActionTier
  /**
   * Target entries must match all the costs and mechanics target tags.
   * An Action will use the keys from the ActionDefinition and fill the value with the proper id.
   * self is a special key that's always present that the server will always override.
   */
  targets: Readonly<{ self: "" } & Record<string, "">>
  costs: ResourceLossMechanic[]
  mechanics: Mechanic[]
}>
