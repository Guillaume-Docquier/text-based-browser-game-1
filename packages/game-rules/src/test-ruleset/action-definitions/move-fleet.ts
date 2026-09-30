import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ActionDefinition, ActionDefinitionSchema } from "#game-rules/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#game-rules/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#game-rules/ruleset/action-definitions/ActionType.ts"
import { FleetMoveEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#game-rules/ruleset/effect-definitions/implementations/ResourceLossEffectDefinition.ts"
import { ResourceType } from "#game-rules/ruleset/effect-definitions/ResourceType.ts"
import { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

function moveFleetDirective({ id, tier, fuel, speed }: { id: string; tier: ActionTier; fuel: number; speed: number }): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    id,
    name: "Move Fleet",
    type: ActionType.DIRECTIVE,
    tier,
    targets: {
      fleet: {
        targetType: TargetType.FLEET,
        constraints: [OwnedBySubmittingPlayerConstraint.create()],
      },
      planet: {
        targetType: TargetType.PLANET,
        constraints: [],
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
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", speed })],
  })
}

export const MoveFleetStandard = moveFleetDirective({
  id: "MOVE_FLEET_STANDARD",
  tier: ActionTier.STANDARD,
  fuel: 1,
  speed: 0.1,
})
export const MoveFleetImproved = moveFleetDirective({
  id: "MOVE_FLEET_IMPROVED",
  tier: ActionTier.IMPROVED,
  fuel: 3,
  speed: 1,
})
export const MoveFleetExceptional = moveFleetDirective({
  id: "MOVE_FLEET_EXCEPTIONAL",
  tier: ActionTier.EXCEPTIONAL,
  fuel: 5,
  speed: 5,
})
