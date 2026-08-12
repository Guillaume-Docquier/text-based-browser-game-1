import type { CostMechanic } from "#turn-processing/engine/mechanics/CostMechanic.ts"
import type { IncomeMechanic } from "#turn-processing/engine/mechanics/IncomeMechanic.ts"
import type { VictoryMechanic } from "#turn-processing/engine/mechanics/VictoryMechanic.ts"

export type Mechanic = CostMechanic | IncomeMechanic | VictoryMechanic
