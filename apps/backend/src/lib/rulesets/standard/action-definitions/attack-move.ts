import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"

export const AttackMoveStandard: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "ATTACK_MOVE_STANDARD",
  name: "Attack Move",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
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
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
  ],
})
