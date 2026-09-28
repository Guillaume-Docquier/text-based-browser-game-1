import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition, ActionDefinitionId } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"

export const GainInfluence: ActionDefinition = {
  id: branded<ActionDefinitionId>("GAIN_INFLUENCE"),
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
