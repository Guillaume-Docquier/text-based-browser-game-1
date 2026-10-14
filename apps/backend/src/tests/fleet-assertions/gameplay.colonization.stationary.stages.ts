import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
  processTurnWithReplay as CapturedprocessTurnWithReplay,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicNaturalRouteFixture as CapturedcreatePublicNaturalRouteFixture } from "#tests/colonization/gameplay.colonization.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { assertPublicState as CapturedassertPublicState } from "#tests/fleet-assertions/gameplay.colonization.stationary-2.ts"
import type { AssertFindPlayerActionResult } from "#tests/fleet-assertions/gameplay.colonization.stationary.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  getPlanets,
  getHome,
  getFleetAt,
  processTurn,
  captureWorkerInput,
  replayWorkerInput,
  replayWorkerInputWithState,
} from "../colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  SeedOutpostHere,
  PublicBudgetBuild30,
  PublicStationarySeedOutpostRuleset,
  PublicColonizationFixtureRuleset,
  required,
  matchesPublicFleet,
  findPublicFleet,
  submitAction,
  readViews,
  createPublicNaturalRouteFixture,
  publiclyBuildFleetToFifty,
} from "../colonization/gameplay.colonization.ts"
import { assertScenarioState2, assertPublicState } from "./gameplay.colonization.stationary-2.ts"
import { assertJourney2, assertReplayedArrival, assertMoveDistance, assertFindPlayerAction } from "./gameplay.colonization.stationary.ts"

export async function createPlayerSetup({ server }: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
  const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000031")
  const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
  const { view: builtView, fleet: sourceFleet } = await publiclyBuildFleetToFifty(fixture)

  const colonizeActionId = await submitAction({
    client: player.client,
    gameId,
    view: builtView,
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: { fleet: sourceFleet.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: target.id },
    selectedInputs: { strength: 35 },
    isInProgress: false,
  })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

  const departedView = await processTurn({
    clock,
    turnsRepository,
    turnProcessor,
    client: player.client,
    gameId,
    turn: selectedView.turn,
  })
  const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === colonizeActionId)
  const sourceRemainder = findPublicFleet(departedView.fleets, { fleetId: sourceFleet.id, stationary: true })
  Assert.isDefined(journey)
  Assert.isDefined(sourceRemainder)

  await assertJourney2({
    journey,
    home,
    target,
    selectedView,
    colonizeActionId,
    sourceFleet,
    sourceRemainder,
    departedView,
    player,
    gameId,
  })
  return {
    player,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    home,
    target,
    sourceFleet,
    colonizeActionId,
    selectedView,
    departedView,
    journey,
  }
}

export type CreatePlayerSetupInput = { server: ConcurrencyTestApiServer }

export type CreatePlayerSetupResult = {
  player: AuthenticatedApiClient
  gameId: number
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  home: Planet
  target: Planet
  sourceFleet: Fleet
  colonizeActionId: string
  selectedView: PlayerView
  departedView: PlayerView
  journey: Fleet
}

export type CreatePlayerSetup2Input = { server: ConcurrencyTestApiServer }

export type CreatePlayerSetup2Result = {
  player: AuthenticatedApiClient
  gameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  view: PlayerView
  home: Planet
  target: Planet
  routeDistance: number
}

export async function createMoveFixtureSetup({
  server,
  clock,
  turnsRepository,
  gameId,
  departedView,
  journey,
  turnProcessor,
  player,
  target,
  home,
  sourceFleet,
  colonizeActionId,
  selectedView,
}: CreateMoveFixtureSetupInput): Promise<CreateMoveFixtureSetupResult> {
  const arrivalInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: departedView.turn,
  })
  const arrivalReplay = replayWorkerInput(arrivalInput)
  Assert.isSuccess(arrivalReplay)
  const replayedArrival = arrivalReplay.value.fleets[journey.id]
  Assert.isDefined(replayedArrival)

  await assertReplayedArrival({
    replayedArrival,
    clock,
    turnsRepository,
    turnProcessor,
    player,
    gameId,
    departedView,
    target,
    home,
    sourceFleet,
    colonizeActionId,
    selectedView,
    arrivalInput,
  })

  const moveFixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000032")
  const {
    player: movePlayer,
    gameId: moveGameId,
    clock: moveClock,
    turnProcessor: moveProcessor,
    turnsRepository: moveTurns,
    home: moveHome,
  } = moveFixture
  const { view: moveBuiltView, fleet: moveSource } = await publiclyBuildFleetToFifty(moveFixture)
  const moveColonizeId = await submitAction({
    client: movePlayer.client,
    gameId: moveGameId,
    view: moveBuiltView,
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: { fleet: moveSource.id, planet: moveFixture.target.id },
    selectedInputs: { strength: 35 },
  })
  const selectedMoveColonize = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
  return {
    moveFixture,
    movePlayer,
    moveGameId,
    moveClock,
    moveProcessor,
    moveTurns,
    moveHome,
    moveSource,
    moveColonizeId,
    selectedMoveColonize,
  }
}

export type CreateMoveFixtureSetupInput = {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  departedView: PlayerView
  journey: Fleet
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  target: Planet
  home: Planet
  sourceFleet: Fleet
  colonizeActionId: string
  selectedView: PlayerView
}

export type CreateMoveFixtureSetupResult = {
  moveFixture: Awaited<ReturnType<typeof CapturedcreatePublicNaturalRouteFixture>>
  movePlayer: AuthenticatedApiClient
  moveGameId: number
  moveClock: ControlledClock
  moveProcessor: TurnProcessor
  moveTurns: TurnsRepository
  moveHome: Planet
  moveSource: Fleet
  moveColonizeId: string
  selectedMoveColonize: PlayerView
}

export async function createMoveDestinationSetup({
  moveClock,
  moveTurns,
  moveProcessor,
  movePlayer,
  moveGameId,
  selectedMoveColonize,
  moveColonizeId,
  moveHome,
  server,
}: CreateMoveDestinationSetupInput): Promise<CreateMoveDestinationSetupResult> {
  const moveColonizePending = await processTurn({
    clock: moveClock,
    turnsRepository: moveTurns,
    turnProcessor: moveProcessor,
    client: movePlayer.client,
    gameId: moveGameId,
    turn: selectedMoveColonize.turn,
  })
  const pendingJourney = moveColonizePending.fleets.find(({ movement }) => movement?.submission.id === moveColonizeId)
  Assert.isDefined(pendingJourney)
  const sourceWithFifteen = getFleetAt(moveColonizePending, moveColonizePending.player.id, moveHome.id, 15)
  const moveAction = moveColonizePending.actions.find(({ id }) => id === "TEST_MOVE_FLEET_STANDARD_2")
  Assert.isDefined(moveAction)
  expect(moveAction.actionDefinitionId).toBe(MoveFleetStandard.id)
  const moveDestination = getPlanets(moveColonizePending).find(({ coordinates }) => coordinates === "45:98:25")
  Assert.isDefined(moveDestination)
  const moveDistance = Math.hypot(moveDestination.x - moveHome.x, moveDestination.y - moveHome.y)

  await assertMoveDistance({ moveDestination, moveDistance, movePlayer, moveGameId, moveColonizePending, moveAction, sourceWithFifteen })

  const simultaneousSelections = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
  expect(simultaneousSelections.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 22 })
  expect(simultaneousSelections.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  expect(simultaneousSelections.fleets.find(({ id }) => id === sourceWithFifteen.id)?.strength).toBe(15)
  const moveInput = await captureWorkerInput({
    server,
    clock: moveClock,
    turnsRepository: moveTurns,
    gameId: moveGameId,
    turn: simultaneousSelections.turn,
  })
  const moveReplay = replayWorkerInput(moveInput)
  Assert.isSuccess(moveReplay)
  const replayedMovedFive = findPublicFleet(Object.values(moveReplay.value.fleets), {
    ownerPlayerId: simultaneousSelections.player.id,
    originPlanetId: moveDestination.id,
    strength: 5,
  })
  Assert.isDefined(replayedMovedFive)
  return { moveDestination, moveDistance, simultaneousSelections, moveInput, replayedMovedFive }
}

export type CreateMoveDestinationSetupInput = {
  moveClock: ControlledClock
  moveTurns: TurnsRepository
  moveProcessor: TurnProcessor
  movePlayer: AuthenticatedApiClient
  moveGameId: number
  selectedMoveColonize: PlayerView
  moveColonizeId: string
  moveHome: Planet
  server: ConcurrencyTestApiServer
}

export type CreateMoveDestinationSetupResult = {
  moveDestination: Planet
  moveDistance: number
  simultaneousSelections: PlayerView
  moveInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replayedMovedFive: ResolutionFleet
}

export async function createPlayerSetup2({ server }: CreatePlayerSetup2Input): Promise<CreatePlayerSetup2Result> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicStationarySeedOutpostRuleset))
  const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000045" })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicStationarySeedOutpostRuleset.id,
      nbSeats: 1,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: Clock.now() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  const view = await player.client.gameplay.getPlayerView.query({ gameId })
  const home = getHome(view)
  const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
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
  const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
  expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

  const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetBuild30.id)
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
  return { player, gameId, clock, turnProcessor, turnsRepository, view, home, target, routeDistance }
}

export async function createArrivalSetup({
  staged,
  view,
  target,
  player,
  gameId,
  server,
  clock,
  turnsRepository,
  turnProcessor,
}: CreateArrivalSetupInput): Promise<CreateArrivalSetupResult> {
  const arrival = Object.values(staged.resolved.fleets).find((fleet) =>
    matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 30 }),
  )
  Assert.isDefined(arrival)
  expect(arrival.arrivedAtTick).toBeDefined()
  const stationary = getFleetAt(view, view.player.id, target.id, 30)
  expect(stationary.id).toBe(arrival.id)
  expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  const colonizeActionId = await submitAction({
    client: player.client,
    gameId,
    view,
    actionDefinitionId: SeedOutpostHere.id,
    selectedTargets: { force: stationary.id, site: target.id },
    selectedInputs: {},
  })
  const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    actionDefinitionId: SeedOutpostHere.id,
    selectedTargets: { force: stationary.id, site: target.id },
    selectedInputs: {},
  })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 93 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

  const workerInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: selectedView.turn,
  })
  const replay = replayWorkerInputWithState(workerInput)
  Assert.isSuccess(replay.resolved)

  const assertAssertFindPlayerActionState1ResolvedPhase8Value1 = replay.resolved.value

  const updatedAssertFindPlayerAction = await assertFindPlayerAction({
    assertAssertFindPlayerActionState1ResolvedPhase8Value1,
    workerInput,
    colonizeActionId,
    player,
    stationary,
    target,
    replay,
    turnProcessor,
    view,
    gameId,
    selectedView,
    server,
  })
  return { arrival, workerInput, replay, updatedAssertFindPlayerAction }
}

export type CreateArrivalSetupInput = {
  staged: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  view: PlayerView
  target: Planet
  player: AuthenticatedApiClient
  gameId: GameId
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

export type CreateArrivalSetupResult = {
  arrival: ResolutionFleet
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  updatedAssertFindPlayerAction: AssertFindPlayerActionResult
}

export async function createClockSetup({ server }: CreateClockSetupInput): Promise<CreateClockSetupResult> {
  const clock = new ControlledClock({ startDate: Clock.now() })
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
  const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000011" })
  const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000012" })
  const carol = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000013" })
  const clients = [alice, bob, carol] as const

  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicColonizationFixtureRuleset.id,
      nbSeats: 3,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await carol.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

  const views = await readViews(clients, gameId)
  const homes = views.map(getHome)
  const homeIdsByPlayer = views.map(({ player }) => player.id)
  const target = getPlanets(required(views[0])).find(({ id }) => id === "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b")
  Assert.isDefined(target)

  assertScenarioState2({ target, homes })
  return { clock, alice, bob, carol, clients, gameId, turnProcessor, turnsRepository, views, homes, homeIdsByPlayer, target }
}

export type CreateClockSetupInput = { server: ConcurrencyTestApiServer }

export type CreateClockSetupResult = {
  clock: ControlledClock
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  carol: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  views: PlayerView[]
  homes: Planet[]
  homeIdsByPlayer: PlayerId[]
  target: Planet
}

export async function createStagedAliceJourneyIdSetup({
  views,
  homeIdsByPlayer,
  target,
  stage,
  homes,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
}: CreateStagedAliceJourneyIdSetupInput): Promise<CreateStagedAliceJourneyIdSetupResult> {
  const stagedAliceJourney = findPublicFleet(required(views[0]).fleets, {
    ownerPlayerId: required(homeIdsByPlayer[0]),
    destinationPlanetId: target.id,
  })
  const stagedCarolJourney = findPublicFleet(required(views[2]).fleets, {
    ownerPlayerId: required(homeIdsByPlayer[2]),
    destinationPlanetId: target.id,
  })
  Assert.isDefined(stagedAliceJourney)
  Assert.isDefined(stagedCarolJourney)
  const stagedAliceJourneyId = stagedAliceJourney.id
  const stagedCarolJourneyId = stagedCarolJourney.id
  expect(stagedAliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
  expect(stagedCarolJourney.distanceToEnd).toBeCloseTo(12.277541605730438, 12)
  const stagingResolutions = [stage.resolved]

  const updatedVerifyPublicState = await assertPublicState({
    homes,
    target,
    stage,
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    views,
    stagingResolutions,
    stagedAliceJourneyId,
    stagedCarolJourneyId,
  })
  return { stagedAliceJourneyId, stagedCarolJourneyId, stagingResolutions, updatedVerifyPublicState }
}

export type CreateStagedAliceJourneyIdSetupInput = {
  views: PlayerView[]
  homeIdsByPlayer: PlayerId[]
  target: Planet
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  homes: Planet[]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
}

export type CreateStagedAliceJourneyIdSetupResult = {
  stagedAliceJourneyId: FleetId
  stagedCarolJourneyId: FleetId
  stagingResolutions: ResolvedTurnState[]
  updatedVerifyPublicState: Awaited<ReturnType<typeof CapturedassertPublicState>>
}
