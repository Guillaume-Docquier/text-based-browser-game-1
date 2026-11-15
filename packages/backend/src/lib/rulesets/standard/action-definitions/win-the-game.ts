import { branded } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { VictoryEffectDefinition } from "shared/domain/ruleset/effect-definitions/VictoryEffectDefinition.ts"

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
