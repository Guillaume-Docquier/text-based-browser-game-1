import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"

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
