import { branded } from "@guillaume-docquier/tools-ts"
import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset-model/actions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset-model/actions/ActionType.ts"
import { FleetBuildMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/FleetBuildMechanic.ts"
import { ResourceLossMechanic } from "#lib/rules-engine/ruleset-model/mechanics/implementations/ResourceLossMechanic.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

function buildFleetDirective({
  id,
  tier,
  influence,
  metal,
  strength,
}: {
  id: string
  tier: ActionTier
  influence: number
  metal: number
  strength: number
}): ActionDefinition {
  return {
    id,
    name: "Build Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    targets: {
      planet: "",
    },
    costs: [
      ResourceLossMechanic.create({
        quantity: branded(influence),
        resourceType: ResourceType.INFLUENCE,
      }),
      ResourceLossMechanic.create({
        quantity: branded(metal),
        resourceType: ResourceType.METAL,
      }),
    ],
    mechanics: [
      FleetBuildMechanic.create({
        planetTag: "planet",
        strength: branded(strength),
      }),
    ],
  }
}

export const BuildFleetStandard = buildFleetDirective({
  id: "BUILD_FLEET_STANDARD",
  tier: ActionTier.STANDARD,
  influence: 2,
  metal: 1,
  strength: 10,
})
export const BuildFleetImproved = buildFleetDirective({
  id: "BUILD_FLEET_IMPROVED",
  tier: ActionTier.IMPROVED,
  influence: 6,
  metal: 3,
  strength: 100,
})
export const BuildFleetExceptional = buildFleetDirective({
  id: "BUILD_FLEET_EXCEPTIONAL",
  tier: ActionTier.EXCEPTIONAL,
  influence: 10,
  metal: 5,
  strength: 1000,
})
