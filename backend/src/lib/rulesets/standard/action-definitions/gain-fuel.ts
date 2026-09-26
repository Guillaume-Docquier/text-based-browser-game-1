import type { ActionDefinition } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"

export const GainFuel: ActionDefinition = {
  id: "GAIN_FUEL",
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
