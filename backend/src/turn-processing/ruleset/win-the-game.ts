import type { ActionDefinition } from "#turn-processing/engine/actions/ActionDefinition.ts"
import { ActionTier } from "#turn-processing/engine/actions/ActionTier.ts"
import { ActionType } from "#turn-processing/engine/actions/ActionType.ts"
import { CostMechanic } from "#turn-processing/engine/mechanics/CostMechanic.ts"
import { ResourceType } from "#turn-processing/engine/mechanics/ResourceType.ts"
import { VictoryMechanic } from "#turn-processing/engine/mechanics/VictoryMechanic.ts"

export const WinTheGame: ActionDefinition = {
  id: "win-the-game-action",
  name: "Win The Game",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  source: "SELF",
  target: "SELF",
  costs: [
    CostMechanic.create({
      quantity: 10,
      resourceType: ResourceType.MONEY,
    }),
  ],
  mechanics: [VictoryMechanic.create({})],
}
