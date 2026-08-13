import type { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import type { IncomeMechanic } from "#lib/rules-engine/mechanics/IncomeMechanic.ts"
import type { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"

export type Mechanic = CostMechanic | IncomeMechanic | VictoryMechanic
