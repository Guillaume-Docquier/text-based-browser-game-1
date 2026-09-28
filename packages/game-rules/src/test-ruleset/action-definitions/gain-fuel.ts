import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "game-rules/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "game-rules/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "game-rules/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "game-rules/ruleset/effect-definitions/ResourceType.ts"

export const GainFuel: ActionDefinition = {
  id: branded("GAIN_FUEL"),
  name: "Refine Fuel",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.ADVANCED,
  targets: {},
  costs: [
    ResourceLossEffectDefinition.create({
      quantity: 2,
      resourceType: ResourceType.INFLUENCE,
    }),
    ResourceLossEffectDefinition.create({
      quantity: 2,
      resourceType: ResourceType.METAL,
    }),
  ],
  effects: [
    ResourceGainEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.FUEL,
    }),
  ],
}
