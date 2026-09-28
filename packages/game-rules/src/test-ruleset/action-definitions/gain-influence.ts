import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#game-rules/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#game-rules/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceType } from "#game-rules/ruleset/effect-definitions/ResourceType.ts"

export const GainInfluence: ActionDefinition = {
  id: branded("GAIN_INFLUENCE"),
  name: "Political Campaign",
  type: ActionType.AGENDA,
  tier: ActionTier.BASIC,
  targets: {},
  costs: [],
  effects: [
    ResourceGainEffectDefinition.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
}
