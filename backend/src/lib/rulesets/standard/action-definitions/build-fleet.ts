import { type ActionDefinition, ActionDefinitionSchema } from "#lib/rules-engine/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#lib/rules-engine/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#lib/rules-engine/ruleset/action-definitions/ActionType.ts"
import { FleetBuildEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/FleetBuildEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#lib/rules-engine/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "#lib/rules-engine/ruleset/effect-definitions/ResourceType.ts"
import { TargetType } from "#lib/rules-engine/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

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
