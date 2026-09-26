import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/actions/ActionType.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/mechanics/ResourceType.ts"

export const GainEnergy: ActionDefinition = {
  id: "GAIN_ENERGY",
  name: "Generate Power",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.IMPROVED,
  targets: {},
  costs: [
    ResourceLossMechanic.create({
      quantity: 3,
      resourceType: ResourceType.INFLUENCE,
    }),
    ResourceLossMechanic.create({
      quantity: 1,
      resourceType: ResourceType.FUEL,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: 5,
      resourceType: ResourceType.ENERGY,
    }),
  ],
}
