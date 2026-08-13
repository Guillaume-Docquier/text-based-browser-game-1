import type { ActionDefinition } from "#lib/rules-engine/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/actions/ActionType.ts"
import { CostMechanic } from "#lib/rules-engine/mechanics/CostMechanic.ts"
import { ResourceType } from "#lib/rules-engine/mechanics/ResourceType.ts"
import { VictoryMechanic } from "#lib/rules-engine/mechanics/VictoryMechanic.ts"

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
