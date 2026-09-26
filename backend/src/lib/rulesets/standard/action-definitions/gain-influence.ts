import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"

export const GainInfluence: ActionDefinition = {
  id: "GAIN_INFLUENCE",
  name: "Political Campaign",
  type: ActionType.AGENDA,
  tier: ActionTier.BASIC,
  targets: {},
  costs: [],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: 5,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
}
