import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { type ActionDefinition, ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetColonizeEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { AtFleetPlanetConstraint } from "shared/domain/ruleset/target-definitions/AtFleetPlanetTargetConstraint.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"

export const ColonizePlanetStandard: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "COLONIZE_PLANET_STANDARD",
  name: "Colonize Planet",
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
        UnclaimedPlanetConstraint.create(),
      ],
    },
  },
  costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: ResourceType.INFLUENCE })],
  effects: [
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
  ],
})

export const ColonizeHereStandard: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "COLONIZE_HERE_STANDARD",
  name: "Colonize Here",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  inputs: {},
  targets: {
    fleet: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    planet: {
      targetType: TargetType.PLANET,
      constraints: [AtFleetPlanetConstraint.create({ sourceFleetTag: "fleet" }), UnclaimedPlanetConstraint.create()],
    },
  },
  costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: ResourceType.INFLUENCE })],
  effects: [FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 })],
})
