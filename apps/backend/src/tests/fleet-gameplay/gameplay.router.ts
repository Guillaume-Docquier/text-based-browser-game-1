import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { FleetActionSelectionParityActionPool } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { SeedOutpostTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect } from "vitest"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import type { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"

export const ComposedReservationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_reservation_parity",
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: AttackMoveTest.id + "_2", actionDefinitionId: AttackMoveTest.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 18,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

export const ComposedGainReservationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_gain_reservation",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 17,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

export const FleetActionParityRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_fleet_action_selection_parity",
  actionPool: FleetActionSelectionParityActionPool,
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 4,
  },
})

export const TestMovementVerificationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_movement_ranges_and_speeds",
  name: "Test Movement Range and Speed Verification",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export const RenamedComposedAssault = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_RENAMED_COMPOSED_ASSAULT",
  name: "Flexible Landing Assault",
  tier: "EXCEPTIONAL",
  inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
  targets: {
    originForce: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    landingSite: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" }),
  ],
})

export const RenamedComposedAssaultRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_renamed_composed_assault_api",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [RenamedComposedAssault.id]: RenamedComposedAssault },
  actionPool: [
    ...TestRuleset.actionPool,
    { id: `${RenamedComposedAssault.id}_1`, actionDefinitionId: RenamedComposedAssault.id },
    { id: `${RenamedComposedAssault.id}_2`, actionDefinitionId: RenamedComposedAssault.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export async function processNextRouterTurn(input: {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
}): Promise<void> {
  input.clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export function withDefaultActionViewFields<T extends { selectedTargets: unknown }>(
  action: T,
): T & { selectedInputs: unknown; isInProgress: false } {
  return {
    ...action,
    selectedInputs: action.selectedTargets === null ? null : {},
    isInProgress: false,
  }
}

export const PublicSeedOutpostBuildSixty = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_API_BUILD_FLEET_SIXTY",
  name: "Fixture API Build Fleet Sixty",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 60 })],
})

export const PublicSeedOutpostApiRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_public_seed_outpost_api_boundary",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [SeedOutpostTest.id]: SeedOutpostTest,
    [PublicSeedOutpostBuildSixty.id]: PublicSeedOutpostBuildSixty,
  },
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "TEST_SEED_OUTPOST_API_1", actionDefinitionId: SeedOutpostTest.id },
    { id: "TEST_SEED_OUTPOST_API_2", actionDefinitionId: SeedOutpostTest.id },
    { id: "FIXTURE_API_BUILD_FLEET_SIXTY_1", actionDefinitionId: PublicSeedOutpostBuildSixty.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 0,
  },
})
