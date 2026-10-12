import { Assert, branded, indexBy, Logger, mulberry32Prng, Rng, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { NonNegativeSafeIntegerSchema } from "shared/domain/NonNegativeSafeInteger.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { ActionType } from "shared/domain/ruleset/action-definitions/ActionType.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
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
import { BuildFleetImproved, BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { GameId, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { actionsTable, fleetsTable, gamesTable, planetsTable, resourcesTable, turnsProcessingTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, type TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"

const TURN_INTERVAL = Time.create(10, UnitOfTime.SECONDS)
const MANUAL_WORKER_TURN_INTERVAL = Time.create(1, UnitOfTime.HOURS)
const MANUAL_WORKER_CLOCK_ADVANCE = Time.create(2, UnitOfTime.HOURS)
const RULESET_ID_FOR_STRENGTH_RACES = "test_strength_concurrency"
const RULESET_ID_FOR_RESOURCE_RACE = "test_resource_concurrency"

const WorkerBuildFleetForty: ActionDefinition = ActionDefinitionSchema.parse({
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

const PostgresColonizeWorkerRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_colonize_worker",
  name: "PostgreSQL Colonize Worker Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [WorkerBuildFleetForty.id]: WorkerBuildFleetForty },
  actionPool: [...TestRuleset.actionPool, { id: "TEST_BUILD_FLEET_FORTY_1", actionDefinitionId: WorkerBuildFleetForty.id }],
})

const WorkerBuildFleetSeventy: ActionDefinition = ActionDefinitionSchema.parse({
  ...WorkerBuildFleetForty,
  id: "TEST_BUILD_FLEET_SEVENTY",
  name: "Fixture Build Seventy",
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 70 })],
})

const ColonizePlanetSpeedFive: ActionDefinition = ActionDefinitionSchema.parse({
  ...ColonizePlanetTest,
  id: "TEST_COLONIZE_PLANET_SPEED_FIVE",
  name: "Fixture Colonize Planet Speed Five",
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 5 }),
    FleetColonizeEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthRequirement: 20 }),
  ],
})

const PostgresColonizeTickZeroPriorityRuleset = Ruleset.create({
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

const publicTickZeroPriorityScenarios = [
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
const PostgresColonizeJourneyValidationRuleset = Ruleset.create({
  ...PostgresColonizeWorkerRuleset,
  id: "test_postgres_colonize_journey_validation",
  name: "PostgreSQL Colonize Journey Validation Test",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
  },
})
const PostgresColonizeSaveFailureRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_postgres_colonize_save_failure",
  name: "PostgreSQL Colonize Save Failure Test",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
    [ResourceType.METAL]: 5,
  },
})

const PostgresArrivalAssaultRuleset = Ruleset.create({
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

type CapturedFleetMovement = NonNullable<PlayerView["fleets"][number]["movement"]>

type PendingAssaultCorruption = {
  label: string
  expectedFailedTurnStatus: typeof TurnStatus.PROCESSING | typeof TurnStatus.AWAITING_PROCESSING
  corruptMovement: (movement: CapturedFleetMovement, otherPlayerId: PlayerView["player"]["id"]) => CapturedFleetMovement
}

const pendingAssaultCorruptions: readonly PendingAssaultCorruption[] = [
  {
    label: "pending ordinal",
    expectedFailedTurnStatus: TurnStatus.PROCESSING,
    corruptMovement: (movement) => ({
      ...movement,
      pendingArrivalEffects: movement.pendingArrivalEffects.map((pendingEffect, index) =>
        index === 0 ? { ...pendingEffect, definitionOrdinal: NonNegativeSafeIntegerSchema.parse(2) } : pendingEffect,
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

type PendingColonizeCorruption = {
  label: string
  corruptMovement: (movement: CapturedFleetMovement) => CapturedFleetMovement
}

const pendingColonizeCorruptions: readonly PendingColonizeCorruption[] = [
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
        definitionOrdinal: NonNegativeSafeIntegerSchema.parse(1),
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
type PublicPendingAssaultFixture = {
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  alicePlayerId: PlayerView["player"]["id"]
  bobPlayerId: PlayerView["player"]["id"]
  gameId: GameId
  aliceSource: PlayerView["fleets"][number]
  bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  pendingView: PlayerView
  capturedJourney: PlayerView["fleets"][number]
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  clock: ControlledClock
}

async function createPublicPendingAssaultFixture(server: ConcurrencyTestApiServer): Promise<PublicPendingAssaultFixture> {
  const clock = new ControlledClock({ startDate: new Date() })
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresArrivalAssaultRuleset))
  const alice = await server.createClient({ authenticated: true })
  const bob = await server.createClient({ authenticated: true })
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresArrivalAssaultRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

  const processDeadlineTurn = async (turn: number): Promise<void> => {
    await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
  }

  const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
  const planets = aliceView.galaxy.systems.flatMap(({ planets }) => planets)
  const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === aliceView.player.id)
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)
  expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

  const buildAction = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(buildAction)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceView.turn,
    submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: aliceHome.id }, selectedInputs: {} },
  })
  await processDeadlineTurn(aliceView.turn)

  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceSource = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === builtView.player.id && originPlanetId === aliceHome.id && movement === undefined,
  )
  Assert.isDefined(aliceSource)
  expect(aliceSource.strength).toBe(10)

  const attackAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
  Assert.isDefined(attackAction)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: builtView.turn,
    submittedActionTargets: {
      actionId: attackAction.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 1 },
    },
  })
  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 98, uncommitted: 93 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 99 })
  expect(selectedView.resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  await processDeadlineTurn(builtView.turn)

  const pendingView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const capturedJourney = pendingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
  Assert.isDefined(capturedJourney)
  expect(capturedJourney).toMatchObject({
    strength: 1,
    destinationPlanetId: bobHome.id,
    distanceToEnd: 3.418312565270031,
    movement: {
      speed: 1,
      submission: {
        id: attackAction.id,
        playerId: aliceView.player.id,
        actionDefinitionId: AttackMoveTest.id,
        selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
        selectedInputs: { strength: 1 },
      },
      pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
    },
  })
  expect(pendingView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 93, uncommitted: 93 })
  expect(pendingView.resources[ResourceType.FUEL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(pendingView.resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(pendingView.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(true)
  expect(pendingView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(9)

  return {
    alice,
    bob,
    alicePlayerId: aliceView.player.id,
    bobPlayerId: bobView.player.id,
    gameId,
    aliceSource,
    bobHome,
    pendingView,
    capturedJourney,
    turnProcessor,
    turnsRepository,
    clock,
  }
}

type PublicPendingColonizeFixture = {
  player: AuthenticatedApiClient
  playerId: PlayerView["player"]["id"]
  gameId: GameId
  home: PlayerView["galaxy"]["systems"][number]["planets"][number]
  target: PlayerView["galaxy"]["systems"][number]["planets"][number]
  sourceFleet: PlayerView["fleets"][number]
  pendingView: PlayerView
  journey: PlayerView["fleets"][number]
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  clock: ControlledClock
}

async function createPublicPendingColonizeFixture(server: ConcurrencyTestApiServer): Promise<PublicPendingColonizeFixture> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeJourneyValidationRuleset))
  const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000031" })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeJourneyValidationRuleset.id,
      nbSeats: 1,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: new Date() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  let view = await player.client.gameplay.getPlayerView.query({ gameId })
  const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
  Assert.isDefined(home)
  Assert.isDefined(target)
  expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
    id: "78821e36-f066-5df0-adbd-19785571d245",
    name: "planet 278494",
    coordinates: "45:98:30",
    x: 58.43842436611536,
    y: 49.61917707239218,
  })
  expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
    id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
    name: "planet 684163",
    coordinates: "55:07:50",
    x: 57.77998524757335,
    y: 50.556704120958045,
  })
  expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()

  const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === WorkerBuildFleetForty.id)
  Assert.isDefined(buildAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: home.id }, selectedInputs: {} },
  })
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })

  view = await player.client.gameplay.getPlayerView.query({ gameId })
  const sourceFleet = view.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === view.player.id && originPlanetId === home.id && movement === undefined,
  )
  Assert.isDefined(sourceFleet)
  expect(sourceFleet.strength).toBe(40)
  expect(view.resources[ResourceType.INFLUENCE].total).toBe(48)

  const colonizeAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizePlanetTest.id)
  Assert.isDefined(colonizeAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: colonizeAction.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    },
  })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
    resources: { [ResourceType.INFLUENCE]: { total: 48, uncommitted: 23 } },
  })
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })

  const pendingView = await player.client.gameplay.getPlayerView.query({ gameId })
  const journey = pendingView.fleets.find(({ movement }) => movement?.submission.id === colonizeAction.id)
  Assert.isDefined(journey)
  expect(journey).toMatchObject({
    strength: 35,
    destinationPlanetId: target.id,

    movement: {
      speed: 1,
      submission: {
        id: colonizeAction.id,
        playerId: view.player.id,
        actionDefinitionId: ColonizePlanetTest.id,
        selectedTargets: { fleet: sourceFleet.id, planet: target.id },
        selectedInputs: { strength: 35 },
      },
      pendingArrivalEffects: [
        { definitionOrdinal: 2, effectDefinition: { type: "FLEET_COLONIZE", parameters: { strengthRequirement: 20 } } },
      ],
    },
  })
  expect(journey.distanceToEnd).toBeCloseTo(0.1456435045942517, 12)
  expect(pendingView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(5)
  expect(pendingView.actions.find(({ id }) => id === colonizeAction.id)?.isInProgress).toBe(true)
  expect(pendingView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 23, uncommitted: 23 })

  return {
    player,
    playerId: pendingView.player.id,
    gameId,
    home,
    target,
    sourceFleet,
    pendingView,
    journey,
    turnProcessor,
    turnsRepository,
    clock,
  }
}
type GameplayRowsSnapshot = {
  fleets: Array<typeof fleetsTable.$inferSelect>
  resources: Array<typeof resourcesTable.$inferSelect>
  planets: Array<typeof planetsTable.$inferSelect>
  actions: Array<typeof actionsTable.$inferSelect>
}

function sortGameplayRows<Row>(rows: Row[]): Row[] {
  return rows.toSorted((left, right) => compareOrdinalStrings(JSON.stringify(left) ?? "", JSON.stringify(right) ?? ""))
}
type ColonizationPersistenceSnapshot = {
  actions: Array<typeof actionsTable.$inferSelect>
  fleets: Array<typeof fleetsTable.$inferSelect>
  games: Array<typeof gamesTable.$inferSelect>
  planets: Array<typeof planetsTable.$inferSelect>
  resources: Array<typeof resourcesTable.$inferSelect>
  turns: Array<typeof turnsTable.$inferSelect>
  turnsProcessing: Array<typeof turnsProcessingTable.$inferSelect>
}

type PublicWorkerReplay = {
  resolved: ResolvedTurnState
  rngState: TurnToProcessModel["rngState"]
  actionOutcomes: Array<{
    playerId: PlayerId
    actionId: string
    outcomes: ResolvedTurnState["resolvedActions"][number]["actionOutcomes"]
  }>
}

function compareOrdinalPair(first: string, second: string, nextFirst: string, nextSecond: string): number {
  const primaryComparison = compareOrdinalStrings(first, second)
  return primaryComparison === 0 ? compareOrdinalStrings(nextFirst, nextSecond) : primaryComparison
}

function findStationaryFleetAt(
  view: PlayerView,
  ownerPlayerId: PlayerId,
  planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerView["fleets"][number] | undefined {
  return view.fleets.find(
    ({ ownerPlayerId: candidateOwner, originPlanetId, movement }) =>
      candidateOwner === ownerPlayerId && originPlanetId === planetId && movement === undefined,
  )
}

function hasFleetAtStrength(
  fleets: ReadonlyArray<{ ownerPlayerId: string | null; originPlanetId: string; strength: number }>,
  ownerPlayerId: PlayerId,
  planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
  strength: number,
): boolean {
  return fleets.some((fleet) => fleet.ownerPlayerId === ownerPlayerId && fleet.originPlanetId === planetId && fleet.strength === strength)
}

function findMovingFleetForOwner(view: PlayerView, ownerPlayerId: PlayerId): PlayerView["fleets"][number] | undefined {
  return view.fleets.find((fleet) => fleet.ownerPlayerId === ownerPlayerId && fleet.destinationPlanetId !== undefined)
}

function findPlayerResource<T extends { playerId: string; resourceType: ResourceType }>(
  resources: readonly T[],
  playerId: PlayerId,
  resourceType: ResourceType,
): T | undefined {
  return resources.find((resource) => resource.playerId === playerId && resource.resourceType === resourceType)
}

function fundingTargetsFor(
  actionDefinitionId: ActionDefinitionId,
  homePlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> {
  if (actionDefinitionId === WorkerBuildFleetForty.id) return { planet: homePlanetId }
  return {}
}

function replayWorkerInput(input: TurnToProcessModel): PublicWorkerReplay {
  const copiedInput = structuredClone(input)
  const rng = Rng.fromState(copiedInput.rngState, mulberry32Prng)
  const resolved = resolveTurn(
    {
      gameId: copiedInput.gameId,
      turn: copiedInput.turn,
      submittedActions: copiedInput.submittedActions,
      players: indexBy("id", Object.values(copiedInput.players)),
      planets: indexBy("id", Object.values(copiedInput.planets)),
      fleets: indexBy("id", Object.values(copiedInput.fleets)),
      winnerPlayerId: undefined,
    },
    copiedInput.ruleset,
    rng,
  )
  Assert.isSuccess(resolved)
  const actionOutcomes = resolved.value.resolvedActions
    .map(({ submittedAction, actionOutcomes: outcomes }) => ({
      playerId: submittedAction.playerId,
      actionId: submittedAction.id,
      outcomes,
    }))
    .toSorted((first, second) => compareOrdinalPair(first.playerId, second.playerId, first.actionId, second.actionId))
  return { resolved: resolved.value, rngState: rng.getState(), actionOutcomes }
}

function reverseWorkerInputEnumeration(input: TurnToProcessModel): TurnToProcessModel {
  const copiedInput = structuredClone(input)
  return {
    ...copiedInput,
    submittedActions: [...copiedInput.submittedActions].toReversed(),
    players: indexBy("id", Object.values(copiedInput.players).toReversed()),
    planets: indexBy("id", Object.values(copiedInput.planets).toReversed()),
    fleets: indexBy("id", Object.values(copiedInput.fleets).toReversed()),
  }
}

function expectedTwoPlayerTieWinner(firstDraw: number, aliceAccountId: string, bobAccountId: string): PlayerId {
  return PlayerIdSchema.parse(firstDraw < 0.5 ? bobAccountId : aliceAccountId)
}

function findViewForPlayer(views: readonly PlayerView[], playerId: PlayerId): PlayerView | undefined {
  return views.find(({ player }) => player.id === playerId)
}

function tieWinnerForce(playerId: PlayerId, winnerId: PlayerId): 15 | 35 {
  return playerId === winnerId ? 15 : 35
}

type WorkerTieFundingRound = {
  actionDefinitionIds: readonly ActionDefinitionId[]
  expectedInfluence: number
}

const workerTieFundingRounds: readonly WorkerTieFundingRound[] = [
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 8 },
  { actionDefinitionIds: [GainInfluence.id, WorkerBuildFleetForty.id, GainMetal.id], expectedInfluence: 10 },
  { actionDefinitionIds: [GainInfluence.id, GainFuel.id], expectedInfluence: 13 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 18 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 23 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 28 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 33 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 38 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 43 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 48 },
  { actionDefinitionIds: [GainInfluence.id], expectedInfluence: 53 },
]

async function readColonizationPersistenceSnapshot(db: Database, gameId: GameId): Promise<ColonizationPersistenceSnapshot> {
  const [actions, fleets, games, planets, resources, turns, turnsProcessing] = await Promise.all([
    db.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
    db.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
    db.select().from(gamesTable).where(eq(gamesTable.id, gameId)),
    db.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
    db.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
    db.select().from(turnsTable).where(eq(turnsTable.gameId, gameId)),
    db.select().from(turnsProcessingTable).where(eq(turnsProcessingTable.gameId, gameId)),
  ])

  return {
    actions: sortGameplayRows(actions),
    fleets: sortGameplayRows(fleets),
    games: sortGameplayRows(games),
    planets: sortGameplayRows(planets),
    resources: sortGameplayRows(resources),
    turns: sortGameplayRows(turns),
    turnsProcessing: sortGameplayRows(turnsProcessing),
  }
}

class InvalidOwnerProjectionTurnsRepository extends TurnsRepository {
  private readonly invalidOwnerPlayerId: PlayerId
  private readonly beforeInvalidSave: (processedTurn: ProcessedTurnModel) => Promise<void>

  public constructor({
    db,
    logger,
    invalidOwnerPlayerId,
    beforeInvalidSave,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    invalidOwnerPlayerId: PlayerId
    beforeInvalidSave: (processedTurn: ProcessedTurnModel) => Promise<void>
  }) {
    super({ db, logger })
    this.invalidOwnerPlayerId = invalidOwnerPlayerId
    this.beforeInvalidSave = beforeInvalidSave
  }

  public override async saveProcessedTurn(
    processedTurn: ProcessedTurnModel,
    db?: Parameters<TurnsRepository["saveProcessedTurn"]>[1],
  ): Promise<Awaited<ReturnType<TurnsRepository["saveProcessedTurn"]>>> {
    if (processedTurn.planetOwnershipChanges.length === 0) {
      return await super.saveProcessedTurn(processedTurn, db)
    }

    await this.beforeInvalidSave(processedTurn)
    return await super.saveProcessedTurn(
      {
        ...processedTurn,
        planetOwnershipChanges: processedTurn.planetOwnershipChanges.map((change) => ({
          ...change,
          ownerPlayerId: this.invalidOwnerPlayerId,
        })),
      },
      db,
    )
  }
}

function findUnoccupiedUnclaimedAssaultDestination(
  view: PlayerView,
  source: PlayerView["galaxy"]["systems"][number]["planets"][number],
  excludedPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
): PlayerView["galaxy"]["systems"][number]["planets"][number] | undefined {
  return view.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find((planet) => {
      const distance = Math.hypot(planet.x - source.x, planet.y - source.y)
      const isUnclaimed = planet.ownerPlayerId === null || planet.ownerPlayerId === undefined
      const isUnoccupied = view.fleets.every(
        ({ originPlanetId, destinationPlanetId }) => originPlanetId !== planet.id && destinationPlanetId !== planet.id,
      )
      return isUnclaimed && planet.id !== excludedPlanetId && distance > 4.418312565270031 && distance <= 5 && isUnoccupied
    })
}

describe("gameplay submission concurrency", () => {
  it("should persist a natural tick-zero Colonize tie through the public worker and reload", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeWorkerRuleset))
    const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
    const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })

    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeWorkerRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })

    const { createdGameId: untouchedGameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeWorkerRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId: untouchedGameId })
    await alice.client.games.startGame.mutate({ gameId: untouchedGameId })

    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    const clients = [alice, bob] as const
    const readViews = async (): Promise<[PlayerView, PlayerView]> =>
      await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
    const submit = async (
      client: AuthenticatedApiClient["client"],
      view: PlayerView,
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }
    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const initialViews = await readViews()
    const allPlanets = initialViews[0].galaxy.systems.flatMap(({ planets }) => planets)
    const homes = clients.map(({ account }) => allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === branded<PlayerId>(account.id)))
    const homeA = homes[0]
    const homeB = homes[1]
    Assert.isDefined(homeA)
    Assert.isDefined(homeB)
    const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
    Assert.isDefined(target)
    expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
      id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
      name: "planet 907284",
      x: 50.87043629812449,
      y: 48.287412347151275,
    })
    const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
    expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
    expect(target.ownerPlayerId).toBeNull()

    const untouchedInitialView = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
    const untouchedTarget = untouchedInitialView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)
    Assert.isDefined(untouchedTarget)
    expect(untouchedTarget.ownerPlayerId).toBeNull()
    expect(untouchedInitialView.fleets).toStrictEqual([])
    expect(untouchedInitialView.turn).toBe(1)

    // Public funding: ship40 costs2I/1M; the single GainMetal and GainFuel actions cover the supported movement costs.
    for (const fundingRound of workerTieFundingRounds) {
      const views = await readViews()
      for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
        const client = clients[ownerIndex]
        const view = views[ownerIndex]
        const home = homes[ownerIndex]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(home)
        for (const actionDefinitionId of fundingRound.actionDefinitionIds) {
          await submit(client.client, view, actionDefinitionId, fundingTargetsFor(actionDefinitionId, home.id), {})
        }
      }
      await processDeadlineTurn(views[0].turn)
      const afterFundingTurn = await readViews()
      expect(afterFundingTurn.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([
        fundingRound.expectedInfluence,
        fundingRound.expectedInfluence,
      ])
    }

    const fundedViews = await readViews()
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const client = clients[ownerIndex]
      const view = fundedViews[ownerIndex]
      const home = homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 53 })
      expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
      const source = findStationaryFleetAt(view, view.player.id, home.id)
      Assert.isDefined(source)
      expect(source.strength).toBe(40)
      await submit(client.client, view, MoveFleetExceptional.id, { fleet: source.id, planet: target.id }, { strength: 35 })
      const selectedView = await client.client.gameplay.getPlayerView.query({ gameId })
      expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 50 })
      expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 1 })
    }
    await processDeadlineTurn(fundedViews[0].turn)

    const stationedViews = await readViews()
    const stationedFleets = clients.map(({ account }, index) => {
      const view = stationedViews[index]
      Assert.isDefined(view)
      return findStationaryFleetAt(view, branded<PlayerId>(account.id), target.id)
    })
    const stationedA = stationedFleets[0]
    const stationedB = stationedFleets[1]
    Assert.isDefined(stationedA)
    Assert.isDefined(stationedB)
    expect([stationedA.strength, stationedB.strength]).toStrictEqual([35, 35])
    for (const view of stationedViews) {
      expect(view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
    }

    const colonizeActionIds: string[] = []
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const client = clients[ownerIndex]
      const view = stationedViews[ownerIndex]
      const fleet = stationedFleets[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(fleet)
      colonizeActionIds.push(await submit(client.client, view, ColonizeHereTest.id, { fleet: fleet.id, planet: target.id }, {}))
      const selected = await client.client.gameplay.getPlayerView.query({ gameId })
      expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
    }

    const observationView = await alice.client.gameplay.getPlayerView.query({ gameId })
    await markManualDeadlineDue({ clock, turnsRepository })
    let observed: TurnToProcessModel | undefined
    const rollbackMessage = `Intentional C3-10 worker input observation rollback for game ${gameId}`
    await expect(
      server.database.transaction(async (tx) => {
        const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
        Assert.isDefined(turn)
        expect(turn.gameId).toBe(gameId)
        expect(turn.turn).toBe(observationView.turn)
        observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
        throw new TransactionRollbackError(rollbackMessage)
      }),
    ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
    Assert.isDefined(observed)
    const observedPreResolutionRngState = observed.rngState
    expect(observedPreResolutionRngState.spareNormal).toBeNull()
    expect([alice.account.id, bob.account.id]).toStrictEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ])
    expect(observed.ruleset.id).toBe(PostgresColonizeWorkerRuleset.id)
    expect(observed.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual([...colonizeActionIds].toSorted())
    expect(observed.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(observed.players[stationedViews[0].player.id]?.resources[ResourceType.INFLUENCE]).toBe(50)
    expect(observed.players[stationedViews[1].player.id]?.resources[ResourceType.INFLUENCE]).toBe(50)
    for (const fleet of stationedFleets) {
      Assert.isDefined(fleet)
      expect(observed.fleets[fleet.id]?.strength).toBe(35)
      expect(observed.fleets[fleet.id]?.movement).toBeUndefined()
    }

    const capturedInput = observed
    Logger.get().info("[C3-10 captured input before replay]", {
      targetOwner: capturedInput.planets[target.id]?.ownerPlayerId,
      submissions: capturedInput.submittedActions.map(({ id, playerId, selectedTargets, selectedInputs }) => ({
        id,
        playerId,
        selectedTargets,
        selectedInputs,
      })),
      contenders: stationedFleets.map((fleet) => {
        Assert.isDefined(fleet)
        return {
          id: fleet.id,
          ownerPlayerId: fleet.ownerPlayerId,
          strength: capturedInput.fleets[fleet.id]?.strength,
          ownerState: capturedInput.players[fleet.ownerPlayerId]?.resources[ResourceType.INFLUENCE],
        }
      }),
    })

    const forwardReplay = replayWorkerInput(observed)
    const reversedReplay = replayWorkerInput(reverseWorkerInputEnumeration(observed))
    // Independently apply the documented two-entry Fisher-Yates draw to the pinned canonical Alice/Bob order.
    const tieOraclePrng = mulberry32Prng(observedPreResolutionRngState.generatorState)
    const firstTieShuffleDraw = tieOraclePrng.next()
    const expectedOwner = expectedTwoPlayerTieWinner(firstTieShuffleDraw, alice.account.id, bob.account.id)
    const expectedNextRngState = {
      generatorState: tieOraclePrng.getState(),
      spareNormal: observedPreResolutionRngState.spareNormal,
    }
    expect(forwardReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(expectedOwner)
    expect(forwardReplay.rngState).toStrictEqual(expectedNextRngState)
    expect(reversedReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(forwardReplay.resolved.planets[target.id]?.ownerPlayerId)
    expect(reversedReplay.actionOutcomes).toStrictEqual(forwardReplay.actionOutcomes)
    expect(reversedReplay.rngState).toStrictEqual(forwardReplay.rngState)
    expect(forwardReplay.resolved.planetOwnershipChanges).toHaveLength(1)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const aliceAfter = await alice.client.gameplay.getPlayerView.query({ gameId })
    const bobAfter = await bob.client.gameplay.getPlayerView.query({ gameId })
    const replayOwner = forwardReplay.resolved.planets[target.id]?.ownerPlayerId
    Assert.isDefined(replayOwner)
    expect(replayOwner).toBe(expectedOwner)
    const persistedOwner = aliceAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId
    expect(persistedOwner).toBe(expectedOwner)
    expect(bobAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(expectedOwner)
    const alicePlayerId = branded<PlayerId>(alice.account.id)
    const bobPlayerId = branded<PlayerId>(bob.account.id)
    const finalViews = [aliceAfter, bobAfter]
    const aliceFinalView = findViewForPlayer(finalViews, alicePlayerId)
    const bobFinalView = findViewForPlayer(finalViews, bobPlayerId)
    Assert.isDefined(aliceFinalView)
    Assert.isDefined(bobFinalView)
    const aliceSurvivor = findStationaryFleetAt(aliceFinalView, alicePlayerId, target.id)
    const bobSurvivor = findStationaryFleetAt(bobFinalView, bobPlayerId, target.id)
    Assert.isDefined(aliceSurvivor)
    Assert.isDefined(bobSurvivor)
    const finalStrengths = [
      { playerId: alicePlayerId, strength: aliceSurvivor.strength },
      { playerId: bobPlayerId, strength: bobSurvivor.strength },
    ]
    expect(finalStrengths).toHaveLength(2)
    expect(aliceSurvivor.strength).toBe(tieWinnerForce(alicePlayerId, expectedOwner))
    expect(bobSurvivor.strength).toBe(tieWinnerForce(bobPlayerId, expectedOwner))
    for (const view of [aliceAfter, bobAfter]) {
      expect(view.turn).toBe(observationView.turn + 1)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
      expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 1, uncommitted: 1 })
      expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      for (const actionId of colonizeActionIds) {
        expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      }
    }

    const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === observationView.turn + 1)
    Assert.isDefined(savedNextTurn)
    expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(
      expectedNextRngState,
    )
    expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(
      forwardReplay.rngState,
    )

    const untouchedAfter = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
    expect(untouchedAfter.turn).toBe(untouchedInitialView.turn)
    expect(untouchedAfter.fleets).toStrictEqual([])
    expect(untouchedAfter.resources).toStrictEqual(untouchedInitialView.resources)
    expect(untouchedAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    Logger.get().info("[C3-10 public worker receipt]", {
      gameId,
      untouchedGameId,
      seed: 147,
      target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
      homes: [homeA, homeB].map((home) => ({ id: home.id, name: home.name, coordinates: home.coordinates })),
      distances,
      observationTurn: observationView.turn,
      loadedRngState: observedPreResolutionRngState,
      loadedPlayers: Object.values(observed.players).map(({ id, resources }) => ({ id, influence: resources[ResourceType.INFLUENCE] })),
      loadedTargetOwner: observed.planets[target.id]?.ownerPlayerId,
      independentlyPinnedContenders: [alice.account.id, bob.account.id],
      independentFirstTieDraw: firstTieShuffleDraw,
      independentExpectedOwner: expectedOwner,
      independentExpectedNextRngState: expectedNextRngState,
      persistedOwner,
      persistedTargetForces: finalStrengths,
      persistedResources: [aliceAfter, bobAfter].map(({ player, resources }) => ({
        playerId: player.id,
        influence: resources[ResourceType.INFLUENCE].total,
        metal: resources[ResourceType.METAL].total,
        fuel: resources[ResourceType.FUEL].total,
      })),
      persistedNextRngState: { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal },
      replayNextRngState: forwardReplay.rngState,
    })
  })

  it.each(publicTickZeroPriorityScenarios)(
    "should prefer valid stationary tick-zero Colonize over a positive-tick arrival with $label",
    async ({ movingStrength, buildActionDefinitionId, builtStrength, bobHomeRemainderStrengths }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()
      const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
      Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeTickZeroPriorityRuleset))
      const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000061" })
      const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000062" })
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: PostgresColonizeTickZeroPriorityRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
          mapGenerationSeed: 147,
        }),
      })
      await bob.client.games.join.mutate({ gameId })
      await alice.client.games.startGame.mutate({ gameId })
      const clock = new ControlledClock({ startDate: new Date() })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
      const readViews = async (): Promise<[PlayerView, PlayerView]> =>
        await Promise.all([alice.client.gameplay.getPlayerView.query({ gameId }), bob.client.gameplay.getPlayerView.query({ gameId })])
      const findPlanetOwner = (
        view: PlayerView,
        planetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"],
      ): PlayerId | null | undefined =>
        view.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === planetId)?.ownerPlayerId
      const submitAction = async (
        client: AuthenticatedApiClient["client"],
        view: PlayerView,
        actionDefinitionId: ActionDefinitionId,
        selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
        selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
      ): Promise<string> => {
        const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
        Assert.isDefined(action)
        await client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
        })
        return action.id
      }
      let views = await readViews()
      const allPlanets = views[0].galaxy.systems.flatMap(({ planets }) => planets)
      const alicePlayerId = branded<PlayerId>(alice.account.id)
      const bobPlayerId = branded<PlayerId>(bob.account.id)
      const homeA = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === alicePlayerId)
      const homeB = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === bobPlayerId)
      const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
      Assert.isDefined(homeA)
      Assert.isDefined(homeB)
      Assert.isDefined(target)
      expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
      expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
        id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
        name: "planet 907284",
        x: 50.87043629812449,
        y: 48.287412347151275,
      })
      const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
      expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
      expect(target.ownerPlayerId).toBeNull()
      for (const view of views) {
        expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
        expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      }

      const aliceInitialView = views[0]
      const bobInitialView = views[1]
      const buildTurn = aliceInitialView.turn
      await submitAction(alice.client, aliceInitialView, WorkerBuildFleetForty.id, { planet: homeA.id }, {})
      await submitAction(bob.client, bobInitialView, buildActionDefinitionId, { planet: homeB.id }, {})
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: buildTurn })
      views = await readViews()
      const aliceBuild = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
      const bobBuild = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
      Assert.isDefined(aliceBuild)
      Assert.isDefined(bobBuild)
      expect(aliceBuild.strength).toBe(40)
      expect(bobBuild.strength).toBe(builtStrength)
      expect(findPlanetOwner(views[0], target.id)).toBeNull()

      const stageTurn = views[0].turn
      await submitAction(alice.client, views[0], MoveFleetExceptional.id, { fleet: aliceBuild.id, planet: target.id }, { strength: 35 })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: stageTurn })
      views = await readViews()
      const stagedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
      const stagedAliceHomeRemainder = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
      const stagedBob = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
      Assert.isDefined(stagedAlice)
      Assert.isDefined(stagedAliceHomeRemainder)
      Assert.isDefined(stagedBob)
      expect(stagedAlice.strength).toBe(35)
      expect(stagedAliceHomeRemainder.strength).toBe(5)
      expect(stagedBob.strength).toBe(builtStrength)
      expect(findPlanetOwner(views[0], target.id)).toBeNull()

      // Act & Assert
      const priorityTurn = views[0].turn
      const aliceColonizeActionId = await submitAction(
        alice.client,
        views[0],
        ColonizeHereTest.id,
        { fleet: stagedAlice.id, planet: target.id },
        {},
      )
      const bobColonizeActionId = await submitAction(
        bob.client,
        views[1],
        ColonizePlanetSpeedFive.id,
        { fleet: stagedBob.id, planet: target.id },
        { strength: movingStrength },
      )
      const selectedViews = await readViews()
      expect(selectedViews.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
        { total: 95, uncommitted: 70 },
        { total: 98, uncommitted: 73 },
      ])
      expect(selectedViews.map(({ resources }) => resources[ResourceType.COLONY])).toStrictEqual([
        { total: 0, uncommitted: 0 },
        { total: 0, uncommitted: 0 },
      ])
      expect(findPlanetOwner(selectedViews[0], target.id)).toBeNull()

      await markManualDeadlineDue({ clock, turnsRepository })
      let observed: TurnToProcessModel | undefined
      const rollbackMessage = "Intentional C3-07 worker input observation rollback for game " + gameId
      await expect(
        server.database.transaction(async (tx) => {
          const turn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
          Assert.isDefined(turn)
          expect(turn.gameId).toBe(gameId)
          expect(turn.turn).toBe(priorityTurn)
          observed = structuredClone(await turnsRepository.startTurnProcessing({ turn, processingStartedAt: clock.now() }, tx))
          throw new TransactionRollbackError(rollbackMessage)
        }),
      ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
      Assert.isDefined(observed)
      const capturedInput = observed
      expect(capturedInput.ruleset.id).toBe(PostgresColonizeTickZeroPriorityRuleset.id)
      expect(capturedInput.planets[target.id]?.ownerPlayerId).toBeNull()
      expect(capturedInput.players[alicePlayerId]?.resources[ResourceType.INFLUENCE]).toBe(95)
      expect(capturedInput.players[bobPlayerId]?.resources[ResourceType.INFLUENCE]).toBe(98)
      expect(capturedInput.fleets[stagedAlice.id]).toMatchObject({
        ownerPlayerId: alicePlayerId,
        originPlanetId: target.id,
        strength: 35,
      })
      expect(capturedInput.fleets[stagedAlice.id]?.movement).toBeUndefined()
      expect(capturedInput.fleets[stagedBob.id]).toMatchObject({
        ownerPlayerId: bobPlayerId,
        originPlanetId: homeB.id,
        strength: builtStrength,
      })
      expect(capturedInput.fleets[stagedBob.id]?.movement).toBeUndefined()
      expect(capturedInput.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
        [aliceColonizeActionId, bobColonizeActionId].toSorted(),
      )

      const replay = replayWorkerInput(capturedInput)
      expect(replay.resolved.planets[target.id]?.ownerPlayerId).toBe(alicePlayerId)
      expect(replay.resolved.fleets[stagedAlice.id]).toMatchObject({
        ownerPlayerId: alicePlayerId,
        originPlanetId: target.id,
        strength: 15,
      })
      const bobArrivals = Object.values(replay.resolved.fleets).filter(({ strength }) => strength === movingStrength)
      expect(bobArrivals).toHaveLength(1)
      const bobArrival = bobArrivals[0]
      Assert.isDefined(bobArrival)
      expect(bobArrival).toMatchObject({
        ownerPlayerId: bobPlayerId,
        originPlanetId: target.id,
        strength: movingStrength,
        arrivedAtTick: 10,
      })
      expect(bobArrival.movement).toBeUndefined()
      const replayAliceOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === aliceColonizeActionId)
      const replayBobOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === bobColonizeActionId)
      Assert.isDefined(replayAliceOutcomes)
      Assert.isDefined(replayBobOutcomes)
      expect(replayAliceOutcomes.outcomes).toContainEqual(
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("colonized Planet") }),
      )
      expect(replayBobOutcomes.outcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }))
      expect(replay.rngState).toStrictEqual(capturedInput.rngState)

      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      views = await readViews()
      expect(views.map(({ turn }) => turn)).toStrictEqual([priorityTurn + 1, priorityTurn + 1])
      for (const view of views) {
        expect(findPlanetOwner(view, target.id)).toBe(alicePlayerId)
        expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      }
      const persistedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
      const persistedBob = findStationaryFleetAt(views[1], bobPlayerId, target.id)
      Assert.isDefined(persistedAlice)
      Assert.isDefined(persistedBob)
      expect(persistedAlice).toMatchObject({ id: stagedAlice.id, strength: 15 })
      expect(persistedBob).toMatchObject({ id: bobArrival.id, strength: movingStrength })
      const bobHomeFleets = views[1].fleets.filter(({ originPlanetId }) => originPlanetId === homeB.id)
      expect(
        bobHomeFleets
          .map(({ ownerPlayerId, movement, strength }) => ({ ownerPlayerId, movement, strength }))
          .toSorted((first, second) => first.strength - second.strength),
      ).toStrictEqual(
        bobHomeRemainderStrengths.map((strength) => ({
          ownerPlayerId: bobPlayerId,
          movement: undefined,
          strength,
        })),
      )
      expect(views[0].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 70, uncommitted: 70 })
      expect(views[1].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 73, uncommitted: 73 })
      expect(views[0].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
      expect(views[1].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
      expect(views[0].resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
      expect(views[1].resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
      expect(views[0].actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
      expect(views[1].actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
      const savedTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const savedNextTurn = savedTurns.find(({ turn }) => turn === priorityTurn + 1)
      Assert.isDefined(savedNextTurn)
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(capturedInput.rngState)
      expect(persistedNextRngState).toStrictEqual(replay.rngState)

      Logger.get().info("[C3-07 public tick-zero priority receipt]", {
        gameId,
        seed: 147,
        movingStrength,
        homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        routeDistances: { aliceStage: distances[0], bobColonize: distances[1] },
        stagedForces: { aliceAtTarget: stagedAlice.strength, bobBeforeDeparture: stagedBob.strength },
        attempts: {
          alice: { actionId: aliceColonizeActionId, selectedStrength: 35, tick: 0 },
          bob: { actionId: bobColonizeActionId, selectedStrength: movingStrength, speed: 5, tick: 10 },
        },
        replay: {
          owner: replay.resolved.planets[target.id]?.ownerPlayerId,
          outcomes: replay.actionOutcomes,
          nextRngState: replay.rngState,
        },
        persisted: {
          owner: findPlanetOwner(views[0], target.id),
          aliceForce: persistedAlice.strength,
          bobForce: persistedBob.strength,
          influence: views.map(({ resources }) => resources[ResourceType.INFLUENCE].total),
          colony: views.map(({ resources }) => resources[ResourceType.COLONY].total),
          nextRngState: persistedNextRngState,
        },
      })
    },
  )

  it("should roll back the real worker save when the ownership player is outside the game", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeSaveFailureRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000041" })
    const createPublicGame = async (turnIntervalSeconds = Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS)): Promise<GameId> => {
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: PostgresColonizeSaveFailureRuleset.id,
          turnIntervalSeconds,
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      return createdGameId
    }
    const gameId = await createPublicGame()
    const untouchedGameId = await createPublicGame(Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS))
    const invalidOwnerPlayerId = PlayerIdSchema.parse("00000000-0000-4000-8000-000000000099")
    const expectedProjection: {
      preSaveSnapshot?: Awaited<ReturnType<typeof readColonizationPersistenceSnapshot>>
      fleetToDeleteId?: PlayerView["fleets"][number]["id"]
      homePlanetId?: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
      playerId?: PlayerId
      fleetUpdate?: {
        id: PlayerView["fleets"][number]["id"]
        ownerPlayerId: PlayerId
        originPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
        strength: number
      }
    } = {}
    const turnsRepository = new InvalidOwnerProjectionTurnsRepository({
      db: server.database,
      logger: Logger.get(),
      invalidOwnerPlayerId,
      beforeInvalidSave: async (processedTurn): Promise<void> => {
        expect(processedTurn.gameId).toBe(gameId)
        expect(processedTurn.planetOwnershipChanges).toHaveLength(1)
        const fleetToDeleteId = expectedProjection.fleetToDeleteId
        const homePlanetId = expectedProjection.homePlanetId
        const playerId = expectedProjection.playerId
        const fleetUpdate = expectedProjection.fleetUpdate
        Assert.isDefined(fleetToDeleteId)
        Assert.isDefined(homePlanetId)
        Assert.isDefined(playerId)
        Assert.isDefined(fleetUpdate)
        expect(processedTurn.planetOwnershipChanges[0]?.planetId).toBe(homePlanetId)
        expect(processedTurn.fleetIdsToDelete).toContain(fleetToDeleteId)
        expect(processedTurn.fleetsToUpdate).toContainEqual(expect.objectContaining(fleetUpdate))
        expect(findPlayerResource(processedTurn.playerResources, playerId, ResourceType.INFLUENCE)?.amount).toBe(22)
        expect(findPlayerResource(processedTurn.playerResources, playerId, ResourceType.METAL)?.amount).toBe(1)
        expectedProjection.preSaveSnapshot = await readColonizationPersistenceSnapshot(server.database, gameId)
      },
    })
    const { turnProcessor } = await createTurnProcessorStub({ db: server.database, clock, turnsRepository })

    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
    const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(home)
    Assert.isDefined(target)
    expect({
      home: { x: home.x, y: home.y },
      target: { x: target.x, y: target.y, ownerPlayerId: target.ownerPlayerId },
      routeDistance: Math.hypot(home.x - target.x, home.y - target.y),
    }).toStrictEqual({
      home: { x: 58.43842436611536, y: 49.61917707239218 },
      target: { x: 57.77998524757335, y: 50.556704120958045, ownerPlayerId: null },
      routeDistance: 1.1456435045942517,
    })
    const submitAndAdvanceTurn = async (
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<void> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })
      view = await player.client.gameplay.getPlayerView.query({ gameId })
    }

    await submitAndAdvanceTurn(BuildFleetImproved.id, { planet: home.id }, {})
    expect(view.fleets.map(({ strength }) => strength)).toStrictEqual([100])
    const source = view.fleets[0]
    Assert.isDefined(source)
    await submitAndAdvanceTurn(ColonizePlanetTest.id, { fleet: source.id, planet: target.id }, { strength: 20 })
    const movingFleet = findMovingFleetForOwner(view, view.player.id)
    Assert.isDefined(movingFleet)
    expect(movingFleet.distanceToEnd).toBeCloseTo(0.1456435045942517, 12)
    expect(view.turn).toBe(3)
    expect(view.fleets.find(({ id }) => id === source.id)?.strength).toBe(80)
    expect(movingFleet.strength).toBe(20)
    expectedProjection.fleetToDeleteId = movingFleet.id
    expectedProjection.homePlanetId = target.id
    expectedProjection.playerId = view.player.id
    expect(
      view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)?.ownerPlayerId,
    ).toBeNull()

    const influenceAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(influenceAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: { actionId: influenceAction.id, selectedTargets: {}, selectedInputs: {} },
    })
    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: home.id }, selectedInputs: {} },
    })
    expectedProjection.fleetUpdate = { id: source.id, ownerPlayerId: view.player.id, originPlanetId: home.id, strength: 90 }

    const failureView = await player.client.gameplay.getPlayerView.query({ gameId })
    const untouchedBefore = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
    expect(untouchedBefore.planets.find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    await markManualDeadlineDue({ clock, turnsRepository })

    expect(await turnProcessor.processNextDueTurn()).toBe("failed")
    const preSaveSnapshot = expectedProjection.preSaveSnapshot
    Assert.isDefined(preSaveSnapshot)
    const afterFailure = await readColonizationPersistenceSnapshot(server.database, gameId)
    expect(findPlayerResource(preSaveSnapshot.resources, failureView.player.id, ResourceType.INFLUENCE)?.amount).toBe(19)
    expect(findPlayerResource(preSaveSnapshot.resources, failureView.player.id, ResourceType.METAL)?.amount).toBe(2)
    expect(preSaveSnapshot.fleets.find(({ id }) => id === source.id)?.strength).toBe(80)
    expect(preSaveSnapshot.fleets.find(({ id }) => id === movingFleet.id)?.strength).toBe(20)
    expect(hasFleetAtStrength(preSaveSnapshot.fleets, failureView.player.id, home.id, 10)).toBe(false)
    expect(afterFailure).toStrictEqual(preSaveSnapshot)
    expect(afterFailure.planets.find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(afterFailure.resources).toStrictEqual(preSaveSnapshot.resources)
    expect(afterFailure.fleets).toStrictEqual(preSaveSnapshot.fleets)
    expect(afterFailure.turns.find(({ turn }) => turn === failureView.turn)).toMatchObject({
      turn: failureView.turn,
      status: TurnStatus.PROCESSING,
    })
    expect(afterFailure.turns.map(({ turn }) => turn).toSorted((first, second) => first - second)).toStrictEqual([1, 2, 3])
    expect(afterFailure.turnsProcessing.find(({ turn }) => turn === failureView.turn)).toMatchObject({
      turn: failureView.turn,
      processingEndedAt: null,
    })
    expect(afterFailure.actions.every(({ turn }) => turn !== failureView.turn + 1)).toBe(true)

    const untouchedAfter = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
    expect(untouchedAfter).toStrictEqual(untouchedBefore)
    expect(untouchedAfter.turns.map(({ turn }) => turn)).toStrictEqual([1])
    expect(untouchedAfter.planets.find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    Logger.get().info("[C3-22 invalid-owner rollback receipt]", {
      gameId,
      untouchedGameId,
      seed: 1234,
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      source: { id: source.id, name: source.name, strength: source.strength },
      arrivingFleet: { id: movingFleet.id, strength: movingFleet.strength, distanceToEnd: movingFleet.distanceToEnd },
      intendedResources: { influence: 22, metal: 1 },
      intendedFleetUpdate: expectedProjection.fleetUpdate,
      intendedFleetDeletions: [movingFleet.id],
      invalidOwnerPlayerId,
      saveReturned: "failed",
      preSaveResources: preSaveSnapshot.resources
        .filter(({ playerId }) => playerId === failureView.player.id)
        .map(({ resourceType, amount }) => ({ resourceType, amount }))
        .toSorted((first, second) => compareOrdinalStrings(first.resourceType, second.resourceType)),
      preSaveFleetStrengths: preSaveSnapshot.fleets.map(({ id, strength }) => ({ id, strength })),
      preSaveTurnStatus: preSaveSnapshot.turns.find(({ turn }) => turn === failureView.turn)?.status,
      postFailureTurnStatus: afterFailure.turns.find(({ turn }) => turn === failureView.turn)?.status,
      ownershipRemainedNull: afterFailure.planets.find(({ id }) => id === target.id)?.ownerPlayerId === null,
      nextTurnCreated: afterFailure.turns.some(({ turn }) => turn === failureView.turn + 1),
    })
  })

  it("should persist an Assault arrival, remove defeated rows, and merge survivors on fresh PostgreSQL", async () => {
    // Arrange: the real API process migrates and seeds a fresh PostgreSQL 18.4 database before public game setup.
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresArrivalAssaultRuleset))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresArrivalAssaultRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    const submit = async ({
      client,
      view,
      actionDefinitionId,
      selectedTargets,
      selectedInputs,
    }: {
      client: AuthenticatedApiClient["client"]
      view: PlayerView
      actionDefinitionId: ActionDefinitionId
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>
    }): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }

    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const allPlanets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
    const aliceHome = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
    const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
    const bobHome = bobView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
    Assert.isDefined(aliceHome)
    Assert.isDefined(bobHome)
    expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

    // Act: create forces through submitted Build actions and actual saved worker turns.
    for (let buildTurn = 0; buildTurn < 2; buildTurn += 1) {
      const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const bobBuildView = await bob.client.gameplay.getPlayerView.query({ gameId })
      await submit({
        client: alice.client,
        view: aliceBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: aliceHome.id },
        selectedInputs: {},
      })
      await submit({
        client: bob.client,
        view: bobBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: bobHome.id },
        selectedInputs: {},
      })
      await processDeadlineTurn(aliceBuildView.turn)
    }
    for (let buildTurn = 0; buildTurn < 3; buildTurn += 1) {
      const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
      await submit({
        client: alice.client,
        view: aliceBuildView,
        actionDefinitionId: BuildFleetStandard.id,
        selectedTargets: { planet: aliceHome.id },
        selectedInputs: {},
      })
      await processDeadlineTurn(aliceBuildView.turn)
    }

    const readyView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceSource = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === aliceHome.id)
      .find(({ movement }) => movement === undefined)
    const bobDefender = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(aliceSource)
    Assert.isDefined(bobDefender)
    expect(aliceSource.strength).toBe(50)
    expect(bobDefender.strength).toBe(20)

    // Arrange: move a seven-strength friendly fleet to the target through a public action for the merge survivor.
    await submit({
      client: alice.client,
      view: readyView,
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 7 },
    })
    const guardDeparture = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(guardDeparture.resources[ResourceType.INFLUENCE].uncommitted).toBe(87)
    expect(guardDeparture.resources[ResourceType.FUEL].uncommitted).toBe(95)
    await processDeadlineTurn(readyView.turn)
    const guardArrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const friendlyGuard = guardArrivalView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .filter(({ strength }) => strength === 7)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(friendlyGuard)
    expect(friendlyGuard).toMatchObject({ strength: 7, originPlanetId: bobHome.id })
    expect(guardArrivalView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    const sourceAfterGuard = guardArrivalView.fleets.find(({ id }) => id === aliceSource.id)
    Assert.isDefined(sourceAfterGuard)
    expect(sourceAfterGuard.strength).toBe(43)

    // Act: submit partial Attack Move, then inspect persisted movement JSON after each actual worker reload.
    const assaultActionId = await submit({
      client: alice.client,
      view: guardArrivalView,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 30 },
    })
    const assaultSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(assaultSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 87, uncommitted: 82 })
    expect(assaultSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
    expect(assaultSelectedView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(43)

    await processDeadlineTurn(guardArrivalView.turn)
    const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId })
    const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === assaultActionId)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({ strength: 30, distanceToEnd: 3.418312565270031, destinationPlanetId: bobHome.id })
    expect(journey.movement).toMatchObject({
      speed: 1,
      submission: {
        id: assaultActionId,
        actionDefinitionId: AttackMoveTest.id,
        selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
        selectedInputs: { strength: 30 },
      },
      pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
    })
    expect(firstReload.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    expect(firstReload.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
    expect(firstReload.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(13)
    // Assert: the new collecting-turn row is blank while the journey retains its historical captured submission.
    expect(firstReload.actions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: null,
      selectedInputs: null,
      isInProgress: true,
    })
    expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 82 })
    expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })

    // Assert: every edit form of the captured instance is rejected with the complete public state unchanged.
    const alternateDestination = findUnoccupiedUnclaimedAssaultDestination(firstReload, aliceHome, bobHome.id)
    Assert.isDefined(alternateDestination)
    const alternateDistance = Math.hypot(alternateDestination.x - aliceHome.x, alternateDestination.y - aliceHome.y)
    expect(alternateDistance).toBeGreaterThan(4.418312565270031)
    expect(alternateDistance).toBeLessThanOrEqual(5)
    const rejectBusySubmission = async (
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<void> => {
      await expect(
        alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: firstReload.turn,
          submittedActionTargets: { actionId: assaultActionId, selectedTargets, selectedInputs },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
    }
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 29 })
    await rejectBusySubmission(null, null)
    await rejectBusySubmission({ fleet: aliceSource.id, planet: alternateDestination.id }, { strength: 29 })
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 13 })

    // Act: a distinct pooled instance moves one source remainder to another legal public destination.
    const remainderAction = firstReload.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
    Assert.isDefined(remainderAction)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets: {
        actionId: remainderAction.id,
        selectedTargets: { fleet: aliceSource.id, planet: alternateDestination.id },
        selectedInputs: { strength: 1 },
      },
    })
    const remainderSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(remainderSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 77 })
    expect(remainderSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 93 })

    const expectedRemainders = [2.418312565270031, 1.418312565270031, 0.418312565270031]
    const advanceRemainderTurn = async (currentView: PlayerView, expectedRemainder: number): Promise<PlayerView> => {
      await processDeadlineTurn(currentView.turn)
      const nextView = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(nextView.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(expectedRemainder)
      expect(nextView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
      expect(nextView.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
      expect(nextView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(true)
      expect(nextView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
      expect(nextView.resources[ResourceType.INFLUENCE].total).toBe(77)
      expect(nextView.resources[ResourceType.FUEL].total).toBe(93)
      expect(nextView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(12)
      return nextView
    }
    const [firstExpectedRemainder, ...laterExpectedRemainders] = expectedRemainders
    Assert.isDefined(firstExpectedRemainder)
    let savedView = await advanceRemainderTurn(remainderSelectedView, firstExpectedRemainder)
    const remainderJourney = savedView.fleets.find(({ movement }) => movement?.submission.id === remainderAction.id)
    Assert.isDefined(remainderJourney)
    const remainderJourneyId = remainderJourney.id
    const remainderJourneyName = remainderJourney.name
    expect(remainderJourney).toMatchObject({
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderJourney.distanceToEnd).toBeCloseTo(alternateDistance - 1, 12)
    for (const expectedRemainder of laterExpectedRemainders) {
      savedView = await advanceRemainderTurn(savedView, expectedRemainder)
    }

    await processDeadlineTurn(savedView.turn)
    const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })

    // Assert: zero-strength enemy and merged incoming rows disappear; the named friendly survivor keeps its identity.
    expect(arrivalView.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === friendlyGuard.id)).toStrictEqual({
      id: friendlyGuard.id,
      name: friendlyGuard.name,
      ownerPlayerId: readyView.player.id,
      strength: 17,
      originPlanetId: bobHome.id,
    })
    expect(arrivalView.fleets.find(({ id }) => id === aliceSource.id)).toMatchObject({ strength: 12, originPlanetId: aliceHome.id })
    expect(arrivalView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(false)
    Assert.isDefined(remainderJourneyId)
    Assert.isDefined(remainderJourneyName)
    expect(arrivalView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
    const remainderAtAssaultArrival = arrivalView.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(remainderAtAssaultArrival)
    expect(remainderAtAssaultArrival).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderAtAssaultArrival.distanceToEnd).toBeGreaterThan(0)
    expect(remainderAtAssaultArrival.distanceToEnd).toBeLessThanOrEqual(1)
    expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 77, uncommitted: 77 })
    expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 93, uncommitted: 93 })

    // The later empty-destination arrival keeps the same child and releases its own pooled instance.
    await processDeadlineTurn(arrivalView.turn)
    const afterRemainderArrival = await alice.client.gameplay.getPlayerView.query({ gameId })
    const stationaryRemainder = afterRemainderArrival.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(stationaryRemainder)
    expect(stationaryRemainder).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: alternateDestination.id,
    })
    expect(stationaryRemainder.movement).toBeUndefined()
    expect(stationaryRemainder.destinationPlanetId).toBeUndefined()
    expect(afterRemainderArrival.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(false)
    expect(afterRemainderArrival.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)

    await processDeadlineTurn(afterRemainderArrival.turn)
    const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(afterEmptyTurn.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(afterEmptyTurn.fleets.find(({ id }) => id === stationaryRemainder.id)).toStrictEqual(stationaryRemainder)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(afterEmptyTurn.actions.find(({ id }) => id === assaultActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(afterEmptyTurn.resources[ResourceType.INFLUENCE].total).toBe(77)
    expect(afterEmptyTurn.resources[ResourceType.FUEL].total).toBe(93)
    expect(afterEmptyTurn.actions.find(({ id }) => id === remainderAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  })

  it.each(pendingColonizeCorruptions)(
    "should reject a persisted captured Colonize $label before gameplay mutation on fresh PostgreSQL",
    async ({ corruptMovement }) => {
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicPendingColonizeFixture(server)
      const { playerId, gameId, pendingView, journey, turnProcessor, turnsRepository, clock } = fixture
      const persistedJourney = (await server.database.select().from(fleetsTable).where(eq(fleetsTable.id, journey.id)))[0]
      Assert.isDefined(persistedJourney)
      Assert.isDefined(persistedJourney.movement)
      expect(persistedJourney.movement).toStrictEqual(journey.movement)
      expect(persistedJourney.ownerPlayerId).toBe(playerId)
      expect(persistedJourney.movement.pendingArrivalEffects).toHaveLength(1)
      expect(persistedJourney.movement.pendingArrivalEffects[0]?.effectDefinition.type).toBe("FLEET_COLONIZE")

      const corruptMovementValue = corruptMovement(persistedJourney.movement)
      await server.database.update(fleetsTable).set({ movement: corruptMovementValue }).where(eq(fleetsTable.id, journey.id))
      await markManualDeadlineDue({ clock, turnsRepository })
      const dueTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const dueTurn = dueTurns.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(dueTurn)
      expect(dueTurn.status).toBe(TurnStatus.AWAITING_PROCESSING)

      const snapshotGameplayRows = async (): Promise<GameplayRowsSnapshot> => {
        const [fleets, resources, planets, actions] = await Promise.all([
          server.database.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
          server.database.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
          server.database.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
          server.database.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
        ])
        return {
          fleets: sortGameplayRows(fleets),
          resources: sortGameplayRows(resources),
          planets: sortGameplayRows(planets),
          actions: sortGameplayRows(actions),
        }
      }
      const gameplayBeforeFailure = await snapshotGameplayRows()
      const turnCountBeforeFailure = dueTurns.length
      expect(await turnProcessor.processNextDueTurn()).toBe("failed")
      expect(await snapshotGameplayRows()).toStrictEqual(gameplayBeforeFailure)

      const turnsAfterFailure = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      expect(turnsAfterFailure).toHaveLength(turnCountBeforeFailure)
      const failedTargetTurn = turnsAfterFailure.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(failedTargetTurn)
      expect(failedTargetTurn.status).toBe(TurnStatus.PROCESSING)
    },
  )

  it.each(pendingAssaultCorruptions)(
    "should reject a persisted $label before gameplay mutation on fresh PostgreSQL",
    async ({ corruptMovement, expectedFailedTurnStatus }) => {
      // Arrange: this isolated database receives a genuine public game, Build, and captured partial Attack Move.
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicPendingAssaultFixture(server)
      const { alicePlayerId, bobPlayerId, gameId, pendingView, capturedJourney, turnProcessor, turnsRepository, clock } = fixture

      const persistedJourney = (await server.database.select().from(fleetsTable).where(eq(fleetsTable.id, capturedJourney.id)))[0]
      Assert.isDefined(persistedJourney)
      Assert.isDefined(persistedJourney.movement)
      expect(persistedJourney.movement).toStrictEqual(capturedJourney.movement)
      expect(persistedJourney.ownerPlayerId).toBe(alicePlayerId)

      // Only the authentic captured movement JSON is fault-injected; fleet row ownership and gameplay setup stay public and intact.
      const corruptMovementValue = corruptMovement(persistedJourney.movement, bobPlayerId)
      await server.database.update(fleetsTable).set({ movement: corruptMovementValue }).where(eq(fleetsTable.id, capturedJourney.id))

      await markManualDeadlineDue({ clock, turnsRepository })

      const dueTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const dueTurn = dueTurns.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(dueTurn)
      expect(dueTurn.status).toBe(TurnStatus.AWAITING_PROCESSING)
      expect(dueTurns.map(({ turn }) => turn)).toContain(pendingView.turn)

      const snapshotGameplayRows = async (): Promise<GameplayRowsSnapshot> => {
        const [fleets, resources, planets, actions] = await Promise.all([
          server.database.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
          server.database.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
          server.database.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
          server.database.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
        ])
        return {
          fleets: sortGameplayRows(fleets),
          resources: sortGameplayRows(resources),
          planets: sortGameplayRows(planets),
          actions: sortGameplayRows(actions),
        }
      }
      const gameplayBeforeFailure = await snapshotGameplayRows()
      const turnCountBeforeFailure = dueTurns.length

      // Act: the actual TurnProcessor loads the persisted invalid journey and rejects this exact due turn.
      expect(await turnProcessor.processNextDueTurn()).toBe("failed")

      // Assert: gameplay rows match the pre-worker snapshot, and the exact target turn remains in processing.
      expect(await snapshotGameplayRows()).toStrictEqual(gameplayBeforeFailure)
      const turnsAfterFailure = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      expect(turnsAfterFailure).toHaveLength(turnCountBeforeFailure)
      const failedTargetTurn = turnsAfterFailure.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(failedTargetTurn)
      expect(failedTargetTurn.status).toBe(expectedFailedTurnStatus)
    },
  )

  it("should serialize real PostgreSQL resource and fleet-strength reservations and round-trip departures", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(StrengthRaceRuleset))
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ResourceRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: strengthGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: StrengthRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: strengthGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    // Build a strength-50 source Fleet using the public API and real PostgreSQL turn persistence.
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const origin = playerView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = playerView.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    for (let buildCount = 0; buildCount < 5; buildCount += 1) {
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: strengthGameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        },
      })
      await processManualDeadlineTurn({
        clock,
        turnProcessor,
        turnsRepository,
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
      })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    }

    const sourceFleet = playerView.fleets[0]
    const moveOne = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const moveTwo = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
    const moveThree = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveOne)
    Assert.isDefined(moveTwo)
    Assert.isDefined(moveThree)
    expect(sourceFleet.strength).toBe(50)

    // Act
    // Both independent 30-strength submissions start together; the turn-row lock permits one.
    const thirtyStrengthGate = createStartGate(2)
    const thirtyStrengthResults = await Promise.allSettled([
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveOne.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveTwo.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])

    // Assert
    expect(thirtyStrengthResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(thirtyStrengthResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterThirtyRace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const firstStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveOne.id)
    const secondStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(firstStrengthAction)
    Assert.isDefined(secondStrengthAction)
    const thirtyStrengthSelections = [firstStrengthAction, secondStrengthAction].filter(({ selectedInputs }) => selectedInputs !== null)
    expect(thirtyStrengthSelections).toHaveLength(1)
    expect(thirtyStrengthSelections[0]?.selectedInputs).toStrictEqual({ strength: 30 })
    const expectedThirtyStrengthSelectionByStatus = {
      fulfilled: {
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 30 },
      },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstStrengthAction, secondStrengthAction].entries()) {
      const submission = thirtyStrengthResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedThirtyStrengthSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
    expect(afterThirtyRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
    expect(afterThirtyRace.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
    const sourceAfterThirtyRace = afterThirtyRace.fleets.find(({ id }) => id === sourceFleet.id)
    const reservedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(sourceAfterThirtyRace)
    Assert.isDefined(reservedThirtyAction)
    expect(sourceAfterThirtyRace.strength).toBe(50)
    expect(sourceAfterThirtyRace.strength - 30).toBe(20)

    const selectedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(selectedThirtyAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: selectedThirtyAction.id, selectedTargets: null, selectedInputs: null },
    })

    // Cancel and replace the same instance concurrently; PostgreSQL may serialize either
    // mutation first, so the persisted selection and reservations must match one complete
    // serialized outcome rather than client response order.
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: {
        actionId: moveThree.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 20 },
      },
    })
    const cancelReplaceGate = createStartGate(2)
    const cancelReplaceResults = await Promise.allSettled([
      (async (): Promise<void> => {
        await cancelReplaceGate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: strengthGameId,
          turn: playerView.turn,
          submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
        })
      })(),
      (async (): Promise<void> => {
        await cancelReplaceGate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: strengthGameId,
          turn: playerView.turn,
          submittedActionTargets: {
            actionId: moveThree.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 19 },
          },
        })
      })(),
    ])
    expect(cancelReplaceResults.every(({ status }) => status === "fulfilled")).toBe(true)
    const afterCancelReplace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveThreeAfterRace = afterCancelReplace.actions.find(({ id }) => id === moveThree.id)
    Assert.isDefined(moveThreeAfterRace)
    const persistedCancelReplaceState = {
      selectedTargets: moveThreeAfterRace.selectedTargets,
      selectedInputs: moveThreeAfterRace.selectedInputs,
      influenceUncommitted: afterCancelReplace.resources[ResourceType.INFLUENCE].uncommitted,
      fuelUncommitted: afterCancelReplace.resources[ResourceType.FUEL].uncommitted,
    }
    expect([
      {
        selectedTargets: null,
        selectedInputs: null,
        influenceUncommitted: 6,
        fuelUncommitted: 2,
      },
      {
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 19 },
        influenceUncommitted: 3,
        fuelUncommitted: 1,
      },
    ]).toContainEqual(persistedCancelReplaceState)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
    })

    // Both 20 and 30 fit the 50-strength source and the exact 6 Influence / 2 Fuel budget.
    const twentyThirtyGate = createStartGate(2)
    const twentyThirtyResults = await Promise.allSettled([
      submitMoveAfterGate(twentyThirtyGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveOne.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 20,
      }),
      submitMoveAfterGate(twentyThirtyGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveTwo.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])
    expect(twentyThirtyResults.every(({ status }) => status === "fulfilled")).toBe(true)
    const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveOneBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveOne.id)
    const moveTwoBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(moveOneBeforeDeparture)
    Assert.isDefined(moveTwoBeforeDeparture)
    expect(moveOneBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveOneBeforeDeparture.selectedInputs).toStrictEqual({ strength: 20 })
    expect(moveTwoBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveTwoBeforeDeparture.selectedInputs).toStrictEqual({ strength: 30 })
    expect(beforeDeparture.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
    expect(beforeDeparture.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })

    // Worker reloads both JSON fields from PostgreSQL; full force removes the original source row.
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId: strengthGameId,
      turn: beforeDeparture.turn,
    })
    const afterDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    expect(afterDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    expect(afterDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
    expect(afterDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
    const departedStrengths = afterDeparture.fleets.map(({ movement }) => {
      Assert.isDefined(movement)
      const strength = movement.submission.selectedInputs[branded<InputTag>("strength")]
      Assert.isDefined(strength)
      return strength
    })
    expect(departedStrengths.toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    for (const [action, strength] of [
      [moveOne, 20],
      [moveTwo, 30],
    ] as const) {
      const journey = afterDeparture.fleets.find(({ movement }) => movement?.submission.id === action.id)
      Assert.isDefined(journey)
      expect(journey).toMatchObject({
        strength,
        originPlanetId: origin.id,
        destinationPlanetId: destination.id,
        distanceToEnd: expect.closeTo(1.04564350459425, 12),
        movement: {
          speed: 0.1,
          departureTurn: beforeDeparture.turn,
          pendingArrivalEffects: [],
          submission: {
            id: action.id,
            playerId: player.account.id,
            actionDefinitionId: MoveFleetStandard.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength },
          },
        },
      })
    }
    expect(afterDeparture.actions.find(({ id }) => id === moveOne.id)?.isInProgress).toBe(true)
    expect(afterDeparture.actions.find(({ id }) => id === moveTwo.id)?.isInProgress).toBe(true)

    // A separate resource-only race cannot spend the same Influence twice.
    const { createdGameId: resourceGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ResourceRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: resourceGameId })
    const resourceView = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    const resourceOrigin = resourceView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === resourceView.player.id)
    const firstBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_1")
    const secondBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_2")
    Assert.isDefined(resourceOrigin)
    Assert.isDefined(firstBuild)
    Assert.isDefined(secondBuild)
    const resourceGate = createStartGate(2)
    const resourceResults = await Promise.allSettled([
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: firstBuild.id,
        planetId: resourceOrigin.id,
      }),
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: secondBuild.id,
        planetId: resourceOrigin.id,
      }),
    ])
    expect(resourceResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(resourceResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterResourceRace = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    expect(afterResourceRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 3, uncommitted: 1 })
    const firstBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === firstBuild.id)
    const secondBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === secondBuild.id)
    Assert.isDefined(firstBuildAfterRace)
    Assert.isDefined(secondBuildAfterRace)
    const expectedBuildSelectionByStatus = {
      fulfilled: { selectedTargets: { planet: resourceOrigin.id }, selectedInputs: {} },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstBuildAfterRace, secondBuildAfterRace].entries()) {
      const submission = resourceResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedBuildSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
  })

  it("should serialize the composed Move and Attack reservation race on fresh PostgreSQL", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ComposedReservationRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ComposedReservationRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    expect({ x: origin.x, y: origin.y }).toStrictEqual({ x: 58.43842436611536, y: 49.61917707239218 })
    expect({ x: destination.x, y: destination.y }).toStrictEqual({ x: 57.77998524757335, y: 50.556704120958045 })

    // Act: create source strength50 with five real saved turns and preserve exactly8I/2F.
    for (let buildCount = 0; buildCount < 5; buildCount += 1) {
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: playerView.turn })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    }

    const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
    const moveAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const attackAction = playerView.actions.find(({ id }) => id === AttackMoveTest.id + "_1")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveAction)
    Assert.isDefined(attackAction)
    expect(sourceFleet.strength).toBe(50)
    expect(playerView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 8 })
    expect(playerView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 2 })

    const startTogether = createStartGate(2)
    const reservationRace = await Promise.allSettled([
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: moveAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 20,
      }),
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: attackAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])
    expect(reservationRace.map(({ status }) => status)).toStrictEqual(["fulfilled", "fulfilled"])

    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    })
    expect(selectedView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 30 },
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
    expect(selectedView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(50)

    // Assert: PostgreSQL-backed actual worker charges both costs once and persists both exact departures.
    await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: selectedView.turn })
    const afterWorkerDeparture = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    expect(afterWorkerDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
    expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
    expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
    expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
  })

  it("should serialize cancellation against Ready with the production PostgreSQL worker", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
    })

    // Act
    // Cancellation and Ready contend on the real turn row; the final influence total identifies the locked set.
    const gate = createStartGate(2)
    const [cancellation, readiness] = await Promise.allSettled([
      (async (): Promise<void> => {
        await gate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
        })
      })(),
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateReadiness.mutate({ gameId, turn: initialView.turn, isReady: true })
      })(),
    ])
    expect(readiness.status).toBe("fulfilled")
    const expectedCancellationResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
    }
    expect(cancellation).toMatchObject(expectedCancellationResultByStatus[cancellation.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
      rejected: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
    }
    const expected = expectedByStatus[cancellation.status]

    // Assert
    const afterReady = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedReadinessObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        isReady: true,
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        isReady: false,
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedReadinessObservation = expectedReadinessObservationByTurn[afterReady.turn]
    Assert.isDefined(expectedReadinessObservation)
    expect(expectedReadinessObservation.statuses).toContain(afterReady.turnStatus)
    expect(afterReady.player.isReady).toBe(expectedReadinessObservation.isReady)
    const observedAction = afterReady.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedReadinessObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedReadinessObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })

  it("should serialize deadline submission against the actual PostgreSQL due-turn transition", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    const turnsRepository = new TurnsRepository({ db: server.database, logger: Logger.get() })

    // Act
    // Submission and the real due-turn transition contend on this game's turn row at its scheduled deadline.
    const gate = createStartGate(2)
    const [submission, closure] = await Promise.allSettled([
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
        })
      })(),
      (async (): Promise<void> => {
        await gate()
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: normalizeApiDate(initialView.turnEndsAt) })
      })(),
    ])
    expect(closure.status).toBe("fulfilled")
    const expectedSubmissionResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
    }
    expect(submission).toMatchObject(expectedSubmissionResultByStatus[submission.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
      rejected: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
    }
    const expected = expectedByStatus[submission.status]

    // Assert
    const afterClosure = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedClosureObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedClosureObservation = expectedClosureObservationByTurn[afterClosure.turn]
    Assert.isDefined(expectedClosureObservation)
    expect(expectedClosureObservation.statuses).toContain(afterClosure.turnStatus)
    const observedAction = afterClosure.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedClosureObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedClosureObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })
})

const StrengthRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_STRENGTH_RACES,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 2,
  },
})

const ComposedReservationRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_reservation_race",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 18,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

const ResourceRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_RESOURCE_RACE,
  actionPool: [...TestRuleset.actionPool, { id: "BUILD_FLEET_STANDARD_2", actionDefinitionId: BuildFleetStandard.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
  },
})

async function markManualDeadlineDue({
  clock,
  turnsRepository,
}: {
  clock: ControlledClock
  turnsRepository: TurnsRepository
}): Promise<void> {
  clock.increment({ time: MANUAL_WORKER_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
}

async function processManualDeadlineTurn({
  clock,
  turnProcessor,
  turnsRepository,
  client,
  gameId,
  turn,
}: {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  client: AuthenticatedApiClient["client"]
  gameId: GameId
  turn: number
}): Promise<void> {
  await markManualDeadlineDue({ clock, turnsRepository })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const nextView = await client.gameplay.getPlayerView.query({ gameId })
  expect(nextView.turn).toBe(turn + 1)
  expect(nextView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
}

function normalizeApiDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

async function waitForCollectingSuccessor({
  client,
  gameId,
  closedTurn,
}: {
  client: AuthenticatedApiClient["client"]
  gameId: number
  closedTurn: number
}): Promise<Awaited<ReturnType<AuthenticatedApiClient["client"]["gameplay"]["getPlayerView"]["query"]>>> {
  await expect
    .poll(
      async () => {
        const view = await client.gameplay.getPlayerView.query({ gameId })
        return { turn: view.turn, turnStatus: view.turnStatus }
      },
      { interval: 100, timeout: 12_000 },
    )
    .toStrictEqual({ turn: closedTurn + 1, turnStatus: "COLLECTING_ACTIONS" })

  return await client.gameplay.getPlayerView.query({ gameId })
}

function createStartGate(parties: number): () => Promise<void> {
  const gate = Promise.withResolvers<undefined>()
  let arrivals = 0
  return async () => {
    arrivals += 1
    if (arrivals === parties) {
      gate.resolve(undefined)
    }
    await gate.promise
  }
}

async function submitMoveAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    fleetId,
    destinationId,
    strength,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    fleetId: string
    destinationId: string
    strength: number
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: {
      actionId,
      selectedTargets: { fleet: fleetId, planet: destinationId },
      selectedInputs: { strength },
    },
  })
}

async function submitBuildAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    planetId,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    planetId: string
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: { actionId, selectedTargets: { planet: planetId }, selectedInputs: {} },
  })
}
