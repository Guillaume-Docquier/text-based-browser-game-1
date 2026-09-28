import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinitionId } from "#lib/db/rulesets/ActionDefinitionId.ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"

export const GainMetal: ActionDefinition = {
  id: branded<ActionDefinitionId>("GAIN_METAL"),
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
