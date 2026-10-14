import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"

function moveFleetDirective({
  id,
  tier,
  fuel,
  speed,
  maxDistance,
}: {
  id: string
  tier: ActionTier
  fuel: number
  speed: number
  maxDistance: number
}): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    id,
    name: "Move Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    inputs: {
      strength: { type: "POSITIVE_INTEGER", label: "Fleet strength" },
    },
    targets: {
      fleet: {
        targetType: TargetType.FLEET,
        constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
      },
      planet: {
        targetType: TargetType.PLANET,
        constraints: [
          WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance }),
          DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
        ],
      },
    },
    costs: [
      ResourceLossEffectDefinition.create({
        quantity: 3,
        resourceType: ResourceType.INFLUENCE,
      }),
      ResourceLossEffectDefinition.create({
        quantity: fuel,
        resourceType: ResourceType.FUEL,
      }),
    ],
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed })],
  })
}

export const MoveFleetStandard = moveFleetDirective({
  id: "MOVE_FLEET_STANDARD",
  tier: ActionTier.STANDARD,
  fuel: 1,
  speed: 0.1,
  maxDistance: 5,
})
export const MoveFleetImproved = moveFleetDirective({
  id: "MOVE_FLEET_IMPROVED",
  tier: ActionTier.IMPROVED,
  fuel: 3,
  speed: 1,
  maxDistance: 10,
})
export const MoveFleetExceptional = moveFleetDirective({
  id: "MOVE_FLEET_EXCEPTIONAL",
  tier: ActionTier.EXCEPTIONAL,
  fuel: 5,
  speed: 5,
  maxDistance: 25,
})
