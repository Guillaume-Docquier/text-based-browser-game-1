import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"
import { ActionTier } from "#turn-processing/engine/actions/ActionTier.ts"
import { ActionType } from "#turn-processing/engine/actions/ActionType.ts"
import { CostMechanic } from "#turn-processing/engine/mechanics/CostMechanic.ts"
import { IncomeMechanic } from "#turn-processing/engine/mechanics/IncomeMechanic.ts"
import { ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"

export const MakeMoreMoney: ActionDefinition = {
  id: "make-more-money-action",
  name: "Make More Money",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  source: "SELF",
  target: "SELF",
  costs: [
    CostMechanic.create({
      quantity: 2,
      resourceType: ResourceType.MONEY,
    }),
  ],
  mechanics: [
    IncomeMechanic.create({
      quantity: 5,
      resourceType: ResourceType.MONEY,
    }),
  ],
}
