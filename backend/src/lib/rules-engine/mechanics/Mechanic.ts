import type { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { MechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"
import type { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"

export type AbstractMechanic = {
  readonly type: string
  readonly targets: Record<string, MechanicTarget>
}

export type Mechanic = CostMechanic | IncomeMechanic | VictoryMechanic
