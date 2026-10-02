import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetBuildEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

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
  return typedParse(ActionDefinitionSchema, {
    id,
    name: "Build Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    targets: {
      planet: {
        targetType: TargetType.PLANET,
        constraints: [OwnedBySubmittingPlayerConstraint.create()],
      },
    },
    costs: [
      ResourceLossEffectDefinition.create({
        quantity: influence,
        resourceType: ResourceType.INFLUENCE,
      }),
      ResourceLossEffectDefinition.create({
        quantity: metal,
        resourceType: ResourceType.METAL,
      }),
    ],
    effects: [
      FleetBuildEffectDefinition.create({
        planetTag: "planet",
        strength,
      }),
    ],
  })
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
