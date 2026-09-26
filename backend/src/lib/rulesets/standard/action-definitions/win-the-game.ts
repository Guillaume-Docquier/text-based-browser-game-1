import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { ResourceLossEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"

export const WinTheGame: ActionDefinition = {
  id: "WIN_THE_GAME",
  name: "Win The Game",
  type: ActionType.PROGRAM,
  tier: ActionTier.EXCEPTIONAL,
  targets: {},
  costs: [
    ResourceLossEffectDefinition.create({
      quantity: 10,
      resourceType: ResourceType.INFLUENCE,
    }),
    ResourceLossEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.METAL,
    }),
    ResourceLossEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.ENERGY,
    }),
    ResourceLossEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.FUEL,
    }),
  ],
  effects: [VictoryEffectDefinition.create()],
}
