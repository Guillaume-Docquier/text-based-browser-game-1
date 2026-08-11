import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"
import { ActionTier } from "#turn-processing/engine/actions/ActionTier.ts"
import { ActionType } from "#turn-processing/engine/actions/ActionType.ts"
import { Income } from "#turn-processing/engine/mechanics/Income.ts"
import { ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"

export const MakeMoreMoney: ActionDefinition = {
  id: "make-more-money-action",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  source: "SELF",
  target: "SELF",
  costs: [{ resourceType: ResourceType.MONEY, quantity: 2 }],
  mechanics: [
    {
      mechanicId: Income.id,
      resolvedParameters: {
        P_RESOURCE_COUNT: 5,
        P_RESOURCE_TYPE: ResourceType.MONEY,
      },
    },
  ],
}
