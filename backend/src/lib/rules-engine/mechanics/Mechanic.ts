import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { MechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 */
type TargetRole = string

export type AbstractMechanic = {
  readonly type: string
  /**
   * Maps target roles to their actual target.
   */
  readonly targets: Record<TargetRole, MechanicTarget>
}

export type Mechanic = CostMechanic | IncomeMechanic | VictoryMechanic
