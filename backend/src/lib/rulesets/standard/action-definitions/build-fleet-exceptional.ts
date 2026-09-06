import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

export const BuildFleetExceptional: ActionDefinition = {
  id: "BUILD_FLEET_EXCEPTIONAL",
  name: "Build Fleet",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  targets: {
    self: "",
    planet: "",
  },
  costs: [
    ResourceLossMechanic.create({ quantity: 10, resourceType: ResourceType.INFLUENCE }),
    ResourceLossMechanic.create({ quantity: 5, resourceType: ResourceType.METAL }),
  ],
  mechanics: [FleetBuildMechanic.create({ strength: 1000 })],
}
