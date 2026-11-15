import { branded } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { ResourceGainEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"

export const GainFuel: ActionDefinition = {
  id: branded("GAIN_FUEL"),
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
