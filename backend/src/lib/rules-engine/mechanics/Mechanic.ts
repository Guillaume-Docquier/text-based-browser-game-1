import type { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/implementations/IncomeMechanic.ts"
import type { VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import type { MechanicTarget } from "#lib/rules-engine/mechanics/MechanicTarget.ts"

export type AbstractMechanic = {
  readonly type: string
  readonly targets: Record<string, MechanicTarget>
}

export type Mechanic = CostMechanic | IncomeMechanic | VictoryMechanic
