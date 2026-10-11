import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { ColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"

export const ColonizePlanetStandard = typedParse(ActionDefinitionSchema, {
  id: "COLONIZE_PLANET_STANDARD",
  name: "Colonize Planet",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  inputs: { strength: { type: "FLEET_STRENGTH", fleetTargetTag: "fleet" } },
  targets: {
    fleet: {
      targetType: "FLEET",
      constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }, { type: "STATIONARY_FLEET" }],
    },
    planet: {
      targetType: "PLANET",
      constraints: [{ type: "UNCLAIMED_PLANET" }, { type: "WITHIN_FLEET_RANGE", fleetTargetTag: "fleet", maximumDistance: 25 }],
    },
  },
  costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: ResourceType.INFLUENCE })],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 10 }),
    ColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", requiredStrength: 20 }),
  ],
})
export const ColonizeStationedPlanetStandard = typedParse(ActionDefinitionSchema, {
  id: "COLONIZE_STATIONED_PLANET_STANDARD",
  name: "Colonize Stationed Planet",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  inputs: {},
  targets: {
    fleet: {
      targetType: "FLEET",
      constraints: [{ type: "OWNED_BY_SUBMITTING_PLAYER", references: {}, parameters: {} }, { type: "STATIONARY_FLEET" }],
    },
    planet: { targetType: "PLANET", constraints: [{ type: "UNCLAIMED_PLANET" }, { type: "AT_FLEET_PLANET", fleetTargetTag: "fleet" }] },
  },
  costs: [ResourceLossEffectDefinition.create({ quantity: 25, resourceType: ResourceType.INFLUENCE })],
  effects: [ColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", requiredStrength: 20 })],
})
