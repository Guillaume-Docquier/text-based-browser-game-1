import type { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import type { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import type { VictoryMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/VictoryMechanic.ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 */
type TargetRole = string

export type AbstractMechanic = {
  readonly type: string
  /**
   * Maps target roles to their actual target.
   */
  readonly targets: Record<TargetRole, TargetDefinition>
}

export type Mechanic = ResourceLossMechanic | ResourceGainMechanic | VictoryMechanic
