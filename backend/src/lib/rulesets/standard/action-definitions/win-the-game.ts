import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { VictoryMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/VictoryMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"

export const WinTheGame: ActionDefinition = {
  id: "WIN_THE_GAME",
  name: "Win The Game",
  type: ActionType.PROGRAM,
  tier: ActionTier.EXCEPTIONAL,
  targets: {},
  costs: [
    ResourceLossMechanic.create({
      quantity: 10,
      resourceType: ResourceType.INFLUENCE,
    }),
    ResourceLossMechanic.create({
      quantity: 5,
      resourceType: ResourceType.METAL,
    }),
    ResourceLossMechanic.create({
      quantity: 5,
      resourceType: ResourceType.ENERGY,
    }),
    ResourceLossMechanic.create({
      quantity: 5,
      resourceType: ResourceType.FUEL,
    }),
  ],
  mechanics: [VictoryMechanic.create()],
}
