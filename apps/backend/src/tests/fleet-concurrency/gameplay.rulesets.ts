import { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { NonNegativeSafeIntegerSchema } from "shared/domain/NonNegativeSafeInteger.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetColonizeEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import type { PendingAssaultCorruption, PendingColonizeCorruption } from "./gameplay.ts"

export const TURN_INTERVAL = Time.create(10, UnitOfTime.SECONDS)

export const MANUAL_WORKER_TURN_INTERVAL = Time.create(1, UnitOfTime.HOURS)

export const MANUAL_WORKER_CLOCK_ADVANCE = Time.create(2, UnitOfTime.HOURS)

export const RULESET_ID_FOR_STRENGTH_RACES = "test_strength_concurrency"

export const RULESET_ID_FOR_RESOURCE_RACE = "test_resource_concurrency"

export const WorkerBuildFleetForty: ActionDefinition = typedParse(ActionDefinitionSchema, {
  id: "TEST_BUILD_FLEET_FORTY",
  name: "Fixture Build Forty",
  type: ActionType.DIRECTIVE,
  tier: ActionTier.STANDARD,
  inputs: {},
  targets: {
    planet: { targetType: TargetType.PLANET, constraints: [OwnedBySubmittingPlayerConstraint.create()] },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.METAL }),
  ],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 40 })],
})

export const PostgresColonizeWorkerRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_colonize_worker",
  name: "PostgreSQL Colonize Worker Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [WorkerBuildFleetForty.id]: WorkerBuildFleetForty },
  actionPool: [...TestRuleset.actionPool, { id: "TEST_BUILD_FLEET_FORTY_1", actionDefinitionId: WorkerBuildFleetForty.id }],
})

export const WorkerBuildFleetSeventy: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...WorkerBuildFleetForty,
  id: "TEST_BUILD_FLEET_SEVENTY",
  name: "Fixture Build Seventy",
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 70 })],
})

export const ColonizePlanetSpeedFive: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizePlanetTest,
  id: "TEST_COLONIZE_PLANET_SPEED_FIVE",
  name: "Fixture Colonize Planet Speed Five",
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 5 }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})

export const PostgresColonizeTickZeroPriorityRuleset = Ruleset.create({
  ...PostgresColonizeWorkerRuleset,
  id: "test_postgres_colonize_tick_zero_priority",
  name: "PostgreSQL Colonize Tick-Zero Priority Test",
  actionDefinitions: {
    ...PostgresColonizeWorkerRuleset.actionDefinitions,
    [WorkerBuildFleetSeventy.id]: WorkerBuildFleetSeventy,
    [ColonizePlanetSpeedFive.id]: ColonizePlanetSpeedFive,
  },
  actionPool: [
    ...PostgresColonizeWorkerRuleset.actionPool,
    { id: "TEST_BUILD_FLEET_SEVENTY_1", actionDefinitionId: WorkerBuildFleetSeventy.id },
    { id: "TEST_COLONIZE_PLANET_SPEED_FIVE_1", actionDefinitionId: ColonizePlanetSpeedFive.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
    [ResourceType.COLONY]: 0,
  },
})

export const publicTickZeroPriorityScenarios = [
  {
    label: "equal 35-strength fleets",
    movingStrength: 35,
    buildActionDefinitionId: WorkerBuildFleetForty.id,
    builtStrength: 40,
    bobHomeRemainderStrengths: [5],
  },
  {
    label: "larger 70-strength moving fleet",
    movingStrength: 70,
    buildActionDefinitionId: WorkerBuildFleetSeventy.id,
    builtStrength: 70,
    bobHomeRemainderStrengths: [],
  },
] as const

export const PostgresColonizeJourneyValidationRuleset = Ruleset.create({
  ...PostgresColonizeWorkerRuleset,
  id: "test_postgres_colonize_journey_validation",
  name: "PostgreSQL Colonize Journey Validation Test",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
  },
})

export const PostgresColonizeAssaultMove: ActionDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizePlanetTest,
  id: "TEST_COLONIZE_ASSAULT_MOVE",
  name: "Colonize after Assault",
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 1 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})

export const PostgresColonizeSaveFailureRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_colonize_save_failure",
  name: "PostgreSQL Colonize Save Failure Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [PostgresColonizeAssaultMove.id]: PostgresColonizeAssaultMove },
  actionPool: [...TestRuleset.actionPool, { id: "TEST_COLONIZE_ASSAULT_MOVE_1", actionDefinitionId: PostgresColonizeAssaultMove.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 5,
  },
})

export const PostgresArrivalAssaultRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_arrival_assault",
  name: "PostgreSQL Arrival Assault Test",
  actionPool: [...TestRuleset.actionPool, { id: "TEST_ATTACK_MOVE_2", actionDefinitionId: AttackMoveTest.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

export const pendingAssaultCorruptions: readonly PendingAssaultCorruption[] = [
  {
    label: "pending ordinal",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0 ? { ...pendingEffect, definitionOrdinal: typedParse(NonNegativeSafeIntegerSchema, 2) } : pendingEffect,
      ),
    }),
  },
  {
    label: "pending Colonize type substituted for Assault",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0
          ? {
              ...pendingEffect,
              effectDefinition: FleetColonizeEffectDefinition.create({
                fleetTag: "fleet",
                planetTag: "planet",
                strengthRequirement: 20,
              }),
            }
          : pendingEffect,
      ),
    }),
  },
  {
    label: "pending Assault mapping",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0
          ? {
              ...pendingEffect,
              effectDefinition: FleetAssaultEffectDefinition.create({ fleetTag: "wrongForce", planetTag: "wrongSite" }),
            }
          : pendingEffect,
      ),
    }),
  },
  {
    label: "captured journey owner binding",
    expectedFailedTurnStatus: TurnStatus.AWAITING_PROCESSING,
    corruptMovement: (movement, otherPlayerId) => ({
      ...movement,
      submission: { ...movement.submission, playerId: otherPlayerId },
    }),
  },
  {
    label: "captured Action Definition binding",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      submission: { ...movement.submission, actionDefinitionId: MoveFleetExceptional.id },
    }),
  },
]

export const pendingColonizeCorruptions: readonly PendingColonizeCorruption[] = [
  {
    label: "type",
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect) => ({
        ...pendingEffect,
        effectDefinition: FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }),
      })),
    }),
  },
  {
    label: "ordinal",
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect) => ({
        ...pendingEffect,
        definitionOrdinal: typedParse(NonNegativeSafeIntegerSchema, 1),
      })),
    }),
  },
  {
    label: "strength requirement",
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect) => ({
        ...pendingEffect,
        effectDefinition: FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 30 }),
      })),
    }),
  },
  {
    label: "target mapping",
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect) => ({
        ...pendingEffect,
        effectDefinition: FleetColonizeEffectDefinition.create({ fleetTag: "wrongForce", planetTag: "wrongSite", strengthRequirement: 20 }),
      })),
    }),
  },
  {
    label: "entry removal",
    corruptMovement: (movement) => ({ ...movement, pendingArrivalEffects: [] }),
  },
]
