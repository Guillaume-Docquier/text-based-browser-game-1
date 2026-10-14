import { Assert, Logger, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { FleetName } from "shared/domain/world/fleets/FleetName.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import type { Planet, Fleet, SelectedTargets, SelectedInputs, Action, PlayerView } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  readColonizationPersistenceSnapshot as CapturedreadColonizationPersistenceSnapshot,
  InvalidOwnerProjectionTurnsRepository as CapturedInvalidOwnerProjectionTurnsRepository,
} from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { RetryActionInput } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { readColonizationPersistenceSnapshot, markManualDeadlineDue } from "../fleet-concurrency/gameplay.scenarios.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  PostgresColonizeSaveFailureRuleset,
  projectPlayerViewActionInputs,
  findPlanetOwnerInView,
} from "../fleet-concurrency/gameplay.ts"
import { assertFindPlayerResource, assertMath } from "./gameplay.worker-rollback.ts"

export async function createClockSetup(input: CreateClockSetupInput): Promise<CreateClockSetupResult> {
  const clock = new ControlledClock({ startDate: Clock.now() })
  const rulesetsRepository = new RulesetsRepository({ db: input.server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeSaveFailureRuleset))
  const player = await input.server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000041" })
  const defender = await input.server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000042" })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeSaveFailureRuleset.id,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await defender.client.games.join.mutate({ gameId })
  await player.client.games.startGame.mutate({ gameId })
  const { createdGameId: untouchedGameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeSaveFailureRuleset.id,
      turnIntervalSeconds: Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId: untouchedGameId })
  const invalidOwnerPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000099")
  const expectedProjection: {
    preSaveSnapshot?: Awaited<ReturnType<typeof readColonizationPersistenceSnapshot>>
    homePlanetId?: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
    playerId?: PlayerId
    defenderFleetToDeleteId?: PlayerView["fleets"][number]["id"]
    homeFleetUpdate?: {
      id: PlayerView["fleets"][number]["id"]
      ownerPlayerId: PlayerId
      originPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
      strength: number
    }
    arrivalFleetUpdate?: {
      id: PlayerView["fleets"][number]["id"]
      ownerPlayerId: PlayerId
      originPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
      strength: number
    }
  } = {}
  return { clock, player, defender, gameId, untouchedGameId, invalidOwnerPlayerId, expectedProjection }
}

export type CreateClockSetupInput = { server: ConcurrencyTestApiServer }

export type CreateClockSetupResult = {
  clock: ControlledClock
  player: AuthenticatedApiClient
  defender: AuthenticatedApiClient
  gameId: GameId
  untouchedGameId: GameId
  invalidOwnerPlayerId: PlayerId
  expectedProjection: {
    preSaveSnapshot?: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
    homePlanetId?: PlanetId
    playerId?: PlayerId
    defenderFleetToDeleteId?: FleetId
    homeFleetUpdate?: { id: FleetId; ownerPlayerId: PlayerId; originPlanetId: PlanetId; strength: number }
    arrivalFleetUpdate?: { id: FleetId; ownerPlayerId: PlayerId; originPlanetId: PlanetId; strength: number }
  }
}

export async function createTurnProcessorSetup(input: CreateTurnProcessorSetupInput): Promise<CreateTurnProcessorSetupResult> {
  const { turnProcessor } = await createTurnProcessorStub({
    db: input.server.database,
    clock: input.clock,
    turnsRepository: input.turnsRepository,
  })

  const view = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const defenderView = await input.defender.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  const defenderHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === defenderView.player.id)
  Assert.isDefined(home)
  Assert.isDefined(defenderHome)
  expect(home).toMatchObject({
    coordinates: "46:93:25",
    x: 63.22189724800524,
    y: 49.62838420494031,
  })
  const target = planets.find(({ id }) => id === "3992658e-fbf9-58e0-b7ee-70a57ca38381")
  Assert.isDefined(target)
  expect(target).toMatchObject({
    coordinates: "56:33:50",
    x: 63.12006530944588,
    y: 53.28310291556491,
  })
  expect(target.ownerPlayerId).toBeNull()
  const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
  expect(routeDistance).toBeCloseTo(3.6561371141548142, 12)
  Logger.get().info("[C3-22 seeded natural retry route]", {
    seed: 1234,
    home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
    target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
    routeDistance,
  })
  return { turnProcessor, view, defenderView, planets, home, defenderHome, target }
}

export type CreateTurnProcessorSetupInput = {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  player: AuthenticatedApiClient
  gameId: GameId
  defender: AuthenticatedApiClient
}

export type CreateTurnProcessorSetupResult = {
  turnProcessor: TurnProcessor
  view: PlayerView
  defenderView: PlayerView
  planets: Planet[]
  home: Planet
  defenderHome: Planet
  target: Planet
}

export async function createFailureViewSetup({
  movingFleet,
  view,
  target,
  expectedProjection,
  stagedDefender,
  player,
  gameId,
  home,
  source,
  server,
  untouchedGameId,
  clock,
  turnsRepository,
  turnProcessor,
}: CreateFailureViewSetupInput): Promise<CreateFailureViewSetupResult> {
  Assert.isDefined(movingFleet.distanceToEnd)
  expect(movingFleet.distanceToEnd).toBeCloseTo(0.6561371141548142, 12)
  Assert.isDefined(movingFleet.distanceToEnd)
  expect(movingFleet.distanceToEnd).toBeGreaterThan(0)
  expect(movingFleet.distanceToEnd).toBeLessThanOrEqual(1)
  expect(findPlanetOwnerInView(view, target.id)).toBeNull()
  expectedProjection.defenderFleetToDeleteId = stagedDefender.id
  expectedProjection.homePlanetId = target.id
  expectedProjection.playerId = view.player.id

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
    submittedActionTargets: {
      actionId: buildAction.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    },
  })
  expectedProjection.homeFleetUpdate = {
    id: source.id,
    ownerPlayerId: view.player.id,
    originPlanetId: home.id,
    strength: 75,
  }
  expectedProjection.arrivalFleetUpdate = {
    id: movingFleet.id,
    ownerPlayerId: view.player.id,
    originPlanetId: target.id,
    strength: 5,
  }

  const failureView = await player.client.gameplay.getPlayerView.query({ gameId })
  const expectedFailureActionInputs = projectPlayerViewActionInputs(failureView)
  expect(expectedFailureActionInputs).toHaveLength(2)
  const untouchedBefore = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
  expect(untouchedBefore.planets.find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  await markManualDeadlineDue({ clock, turnsRepository })

  expect(await turnProcessor.processNextDueTurn()).toBe("failed")
  const preSaveSnapshot = expectedProjection.preSaveSnapshot
  Assert.isDefined(preSaveSnapshot)
  return { failureView, expectedFailureActionInputs, untouchedBefore, preSaveSnapshot }
}

export type CreateFailureViewSetupInput = {
  movingFleet: Fleet
  view: PlayerView
  target: Planet
  expectedProjection: {
    preSaveSnapshot?: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
    homePlanetId?: PlanetId
    playerId?: PlayerId
    defenderFleetToDeleteId?: FleetId
    homeFleetUpdate?: { id: FleetId; ownerPlayerId: PlayerId; originPlanetId: PlanetId; strength: number }
    arrivalFleetUpdate?: { id: FleetId; ownerPlayerId: PlayerId; originPlanetId: PlanetId; strength: number }
  }
  stagedDefender: Fleet
  player: AuthenticatedApiClient
  gameId: GameId
  home: Planet
  source: Fleet
  server: ConcurrencyTestApiServer
  untouchedGameId: GameId
  clock: ControlledClock
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  turnProcessor: TurnProcessor
}

export type CreateFailureViewSetupResult = {
  failureView: PlayerView
  expectedFailureActionInputs: RetryActionInput[]
  untouchedBefore: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  preSaveSnapshot: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
}

export async function createAfterFailureSetup(input: CreateAfterFailureSetupInput): Promise<CreateAfterFailureSetupResult> {
  const afterFailure = await readColonizationPersistenceSnapshot(input.server.database, input.gameId)

  await assertFindPlayerResource({ ...input, afterFailure })

  Assert.isSuccess(await input.turnsRepository.resetProcessingAttempt({ gameId: input.gameId, turn: input.failureView.turn }))
  const afterReset = await readColonizationPersistenceSnapshot(input.server.database, input.gameId)
  expect(afterReset.actions).toStrictEqual(afterFailure.actions)
  expect(afterReset.fleets).toStrictEqual(afterFailure.fleets)
  expect(afterReset.planets).toStrictEqual(afterFailure.planets)
  expect(afterReset.resources).toStrictEqual(afterFailure.resources)
  const failedTurnRow = afterFailure.turns.find(({ turn }) => turn === input.failureView.turn)
  const resetTurnRow = afterReset.turns.find(({ turn }) => turn === input.failureView.turn)
  Assert.isDefined(failedTurnRow)
  Assert.isDefined(resetTurnRow)
  expect({
    rngGeneratorState: resetTurnRow.rngGeneratorState,
    rngSpareNormal: resetTurnRow.rngSpareNormal,
  }).toStrictEqual({
    rngGeneratorState: failedTurnRow.rngGeneratorState,
    rngSpareNormal: failedTurnRow.rngSpareNormal,
  })
  expect(resetTurnRow.status).toBe(TurnStatus.AWAITING_PROCESSING)
  return { afterFailure, afterReset }
}

export type CreateAfterFailureSetupInput = {
  server: ConcurrencyTestApiServer
  gameId: GameId
  preSaveSnapshot: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  failureView: PlayerView
  source: Fleet
  movingFleet: Fleet
  stagedDefender: Fleet
  target: Planet
  expectedFailureActionInputs: RetryActionInput[]
  untouchedGameId: GameId
  untouchedBefore: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
}

export type CreateAfterFailureSetupResult = {
  afterFailure: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  afterReset: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
}

export async function createAliceHomeSetup(input: CreateAliceHomeSetupInput): Promise<CreateAliceHomeSetupResult> {
  const initialView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const allPlanets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
  const aliceHome = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
  const bobView = await input.bob.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const bobHome = bobView.galaxy.systems.flatMap(({ planets }) => planets).find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)

  await assertMath({ ...input, aliceHome, bobHome })

  const readyView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
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
  await input.submit({
    client: input.alice.client,
    view: readyView,
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
    selectedInputs: { strength: 7 },
  })
  const guardDeparture = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(guardDeparture.resources[ResourceType.INFLUENCE].uncommitted).toBe(87)
  expect(guardDeparture.resources[ResourceType.FUEL].uncommitted).toBe(95)
  await input.processDeadlineTurn(readyView.turn)
  const guardArrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
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
  return { aliceHome, bobHome, readyView, aliceSource, bobDefender, guardArrivalView, friendlyGuard }
}

export type CreateAliceHomeSetupInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  bob: AuthenticatedApiClient
  submit: SubmitCallback
  processDeadlineTurn: (turn: number) => Promise<void>
}

export type CreateAliceHomeSetupResult = {
  aliceHome: Planet
  bobHome: Planet
  readyView: PlayerView
  aliceSource: Fleet
  bobDefender: Fleet
  guardArrivalView: PlayerView
  friendlyGuard: Fleet
}

export async function createRemainderJourneyIdSetup(
  input: CreateRemainderJourneyIdSetupInput,
): Promise<CreateRemainderJourneyIdSetupResult> {
  const [firstExpectedRemainder, ...laterExpectedRemainders] = input.expectedRemainders
  Assert.isDefined(firstExpectedRemainder)
  let savedView = await input.advanceRemainderTurn(input.remainderSelectedView, firstExpectedRemainder)
  const remainderJourney = savedView.fleets.find(({ movement }) => movement?.submission.id === input.remainderAction.id)
  Assert.isDefined(remainderJourney)
  const remainderJourneyId = remainderJourney.id
  const remainderJourneyName = remainderJourney.name
  expect(remainderJourney).toMatchObject({
    strength: 1,
    originPlanetId: input.aliceHome.id,
    destinationPlanetId: input.alternateDestination.id,
    movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
  })
  expect(remainderJourney.distanceToEnd).toBeCloseTo(input.alternateDistance - 1, 12)
  for (const expectedRemainder of laterExpectedRemainders) {
    savedView = await input.advanceRemainderTurn(savedView, expectedRemainder)
  }

  await input.processDeadlineTurn(savedView.turn)
  const arrivalView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  // Assert: zero-strength enemy and merged incoming rows disappear; the named friendly survivor keeps its identity.
  expect(arrivalView.fleets.find(({ id }) => id === input.bobDefender.id)).toBeUndefined()
  expect(arrivalView.fleets.find(({ id }) => id === input.journey.id)).toBeUndefined()
  expect(arrivalView.fleets.find(({ id }) => id === input.friendlyGuard.id)).toStrictEqual({
    id: input.friendlyGuard.id,
    name: input.friendlyGuard.name,
    ownerPlayerId: input.readyView.player.id,
    strength: 17,
    originPlanetId: input.bobHome.id,
  })
  expect(arrivalView.fleets.find(({ id }) => id === input.aliceSource.id)).toMatchObject({
    strength: 12,
    originPlanetId: input.aliceHome.id,
  })
  expect(arrivalView.actions.find(({ id }) => id === input.assaultActionId)?.isInProgress).toBe(false)
  Assert.isDefined(remainderJourneyId)
  Assert.isDefined(remainderJourneyName)
  expect(arrivalView.actions.find(({ id }) => id === input.remainderAction.id)?.isInProgress).toBe(true)
  const remainderAtAssaultArrival = arrivalView.fleets.find(({ id }) => id === remainderJourneyId)
  Assert.isDefined(remainderAtAssaultArrival)
  expect(remainderAtAssaultArrival).toMatchObject({
    id: remainderJourneyId,
    name: remainderJourneyName,
    ownerPlayerId: input.readyView.player.id,
    strength: 1,
    originPlanetId: input.aliceHome.id,
    destinationPlanetId: input.alternateDestination.id,
    movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
  })
  expect(remainderAtAssaultArrival.distanceToEnd).toBeGreaterThan(0)
  expect(remainderAtAssaultArrival.distanceToEnd).toBeLessThanOrEqual(1)
  expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 77, uncommitted: 77 })
  expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 93, uncommitted: 93 })
  return { remainderJourneyId, remainderJourneyName, arrivalView }
}

export type CreateRemainderJourneyIdSetupInput = {
  expectedRemainders: number[]
  advanceRemainderTurn: (currentView: PlayerView, expectedRemainder: number) => Promise<PlayerView>
  remainderSelectedView: PlayerView
  remainderAction: Action
  aliceHome: Planet
  alternateDestination: Planet
  alternateDistance: number
  processDeadlineTurn: (turn: number) => Promise<void>
  alice: AuthenticatedApiClient
  gameId: GameId
  bobDefender: Fleet
  journey: Fleet
  friendlyGuard: Fleet
  readyView: PlayerView
  bobHome: Planet
  aliceSource: Fleet
  assaultActionId: string
}

export type CreateRemainderJourneyIdSetupResult = { remainderJourneyId: FleetId; remainderJourneyName: FleetName; arrivalView: PlayerView }

type SubmitCallback = (__0: {
  client: AuthenticatedApiClient["client"]
  view: PlayerView
  actionDefinitionId: ActionDefinitionId
  selectedTargets: DeepUnbranded<SelectedTargets>
  selectedInputs: DeepUnbranded<SelectedInputs>
}) => Promise<string>
