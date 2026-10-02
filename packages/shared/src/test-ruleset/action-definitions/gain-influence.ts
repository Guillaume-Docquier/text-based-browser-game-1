import { branded } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"

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
