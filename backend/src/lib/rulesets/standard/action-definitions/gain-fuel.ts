import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import { ResourceGainMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceGainMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

export const GainFuel: ActionDefinition = {
  id: "GAIN_FUEL",
  name: "Refine Fuel",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.ADVANCED,
  targets: {},
  costs: [
    ResourceLossMechanic.create({
      quantity: branded(2),
      resourceType: ResourceType.INFLUENCE,
    }),
    ResourceLossMechanic.create({
      quantity: branded(2),
      resourceType: ResourceType.METAL,
    }),
  ],
  mechanics: [
    ResourceGainMechanic.create({
      quantity: branded(5),
      resourceType: ResourceType.FUEL,
    }),
  ],
}
