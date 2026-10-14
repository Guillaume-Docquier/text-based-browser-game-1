import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetAssaultEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { AtFleetPlanetConstraint } from "#shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { DifferentFromFleetOriginConstraint } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"

export const AttackMoveTest: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_ATTACK_MOVE",
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

export const FlexibleAssaultTest: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_FLEXIBLE_ASSAULT",
  name: "Flexible Siege",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.EXCEPTIONAL,
  inputs: {
    force: { type: "POSITIVE_INTEGER", label: "Assault force" },
  },
  targets: {
    source: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    destination: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "source", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "source" }),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "source", planetTag: "destination", strengthTag: "force", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "source", planetTag: "destination" }),
  ],
})

export const StationaryAssaultTest: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_STATIONARY_ASSAULT",
  name: "Stationary Assault",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.IMPROVED,
  inputs: {},
  targets: {
    station: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    battlePlanet: {
      targetType: TargetType.PLANET,
      constraints: [AtFleetPlanetConstraint.create({ sourceFleetTag: "station" })],
    },
  },
  costs: [],
  effects: [FleetAssaultEffectDefinition.create({ fleetTag: "station", planetTag: "battlePlanet" })],
})
