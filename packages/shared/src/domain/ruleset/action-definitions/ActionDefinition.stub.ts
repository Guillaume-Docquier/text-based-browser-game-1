import type { DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ActionDefinition, ActionDefinitionSchema } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "#shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "#shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetMoveEffectDefinition } from "#shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"

export function createActionDefinitionStub({ ...overrides }: Partial<DeepUnbranded<ActionDefinition>> = {}): ActionDefinition {
  return typedParse(ActionDefinitionSchema, {
    id: "TEST_ACTION",
    name: "Test Action",
    type: ActionType.DIRECTIVE,
    tier: ActionTier.STANDARD,
    inputs: {},
    targets: {},
    costs: [],
    effects: [],
    ...overrides,
  })
}

/**
 * Creates a valid movement declaration without arranging a game world.
 */
export function createFleetMoveActionDefinitionStub({ speed = 2, range = 5 }: { speed?: number; range?: number } = {}): ActionDefinition {
  return createActionDefinitionStub({
    id: "RENAMED",
    name: "Traverse",
    tier: "BASIC",
    inputs: { force: { type: "FLEET_STRENGTH", fleetTargetTag: "craft" } },
    targets: {
      craft: { targetType: "FLEET", constraints: [OwnedBySubmittingPlayerConstraint.create(), { type: "STATIONARY_FLEET" }] },
      route: { targetType: "PLANET", constraints: [{ type: "WITHIN_FLEET_RANGE", fleetTargetTag: "craft", maximumDistance: range }] },
    },
    costs: [
      ResourceLossEffectDefinition.create({ resourceType: "INFLUENCE", quantity: 3 }),
      ResourceLossEffectDefinition.create({ resourceType: "FUEL", quantity: 1 }),
    ],
    effects: [FleetMoveEffectDefinition.create({ fleetTag: "craft", planetTag: "route", strengthTag: "force", speed })],
  })
}
