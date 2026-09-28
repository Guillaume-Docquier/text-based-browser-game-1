import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "game-rules/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "game-rules/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "game-rules/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "game-rules/ruleset/effect-definitions/ResourceType.ts"

export const GainMetal: ActionDefinition = {
  id: branded("GAIN_METAL"),
  name: "Extract Metal",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: {},
  costs: [
    ResourceLossEffectDefinition.create({
      quantity: 1,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  effects: [
    ResourceGainEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.METAL,
    }),
  ],
}
