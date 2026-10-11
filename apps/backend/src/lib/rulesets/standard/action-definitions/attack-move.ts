import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { AssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/AssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
export const AttackMoveStandard = typedParse(ActionDefinitionSchema, {
  id: "ATTACK_MOVE_STANDARD",
  name: "Attack Move",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
  targets: {
    fleet: { targetType: TargetType.FLEET, constraints: [OwnedBySubmittingPlayerConstraint.create(), { type: "STATIONARY_FLEET" }] },
    planet: { targetType: TargetType.PLANET, constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: 5 }] },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
    AssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
  ],
})
