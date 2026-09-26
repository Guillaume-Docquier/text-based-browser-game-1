import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"

export const GainMetal: ActionDefinition = {
  id: "GAIN_METAL",
  name: "Extract Metal",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  targets: {},
  costs: [
    ResourceLossMechanic.create({
      quantity: 1,
      resourceType: ResourceType.INFLUENCE,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: 5,
      resourceType: ResourceType.METAL,
    }),
  ],
}
