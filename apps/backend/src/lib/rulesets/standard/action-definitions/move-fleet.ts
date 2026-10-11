import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"

function moveFleetDirective({
  id,
  tier,
  fuel,
  speed,
  range,
}: {
  id: string
  tier: ActionTier
  fuel: number
  speed: number
  range: number
}): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    id,
    name: "Move Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
    targets: {
      fleet: {
        targetType: TargetType.FLEET,
        constraints: [OwnedBySubmittingPlayerConstraint.create(), { type: "STATIONARY_FLEET" }],
      },
      planet: {
        targetType: TargetType.PLANET,
        constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: range }],
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
  range: 5,
})
export const MoveFleetImproved = moveFleetDirective({
  id: "MOVE_FLEET_IMPROVED",
  tier: ActionTier.IMPROVED,
  fuel: 3,
  speed: 1,
  range: 5,
})
export const MoveFleetExceptional = moveFleetDirective({
  id: "MOVE_FLEET_EXCEPTIONAL",
  tier: ActionTier.EXCEPTIONAL,
  fuel: 5,
  speed: 5,
  range: 25,
})
