import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/implementations/CostMechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/implementations/VictoryMechanic.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"

export const WinTheGame: ActionDefinition = {
  id: "WIN_THE_GAME",
  name: "Win The Game",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  targets: {
    self: "",
  },
  costs: [
    CostMechanic.create({
      quantity: 10,
      resourceType: ResourceType.MONEY,
    }),
  ],
  mechanics: [VictoryMechanic.create()],
}
