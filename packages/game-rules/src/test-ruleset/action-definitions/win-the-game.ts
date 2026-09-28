import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#game-rules/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#game-rules/ruleset/action-definitions/ActionType.ts"
import { ResourceLossEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/VictoryEffectDefinition.ts"
import { ResourceType } from "#game-rules/ruleset/effect-definitions/ResourceType.ts"

export const WinTheGame: ActionDefinition = {
  id: branded("WIN_THE_GAME"),
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
