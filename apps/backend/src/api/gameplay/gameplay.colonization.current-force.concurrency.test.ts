import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView, Fleet, Planet } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  processTurnWithReplay as CapturedprocessTurnWithReplay,
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicTwoPlayerFixture as CapturedcreatePublicTwoPlayerFixture } from "#tests/colonization/gameplay.colonization.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { AssertJourneyResult } from "#tests/fleet-assertions/gameplay.colonization-2.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  getPlanets,
  getHome,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  PublicBudgetBuild35,
  PublicBudgetStageFleet,
  PublicColonizationBudgetRuleset,
  BuildFleet10ForStaging,
  BuildFleet35,
  MoveFleetSpeed10,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  findPlayerAction,
  findResolvedAction,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertJourney } from "../../tests/fleet-assertions/gameplay.colonization-2.ts"
import { assertRequired, assertPersistedJourney, assertPersistedNextRngState2 } from "../../tests/fleet-assertions/gameplay.colonization.ts"

describe("public Colonization worker companions", () => {
  it("should use the current public stationary force after Move and Assault before Colonization", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    const viewsScenario12 = await prepareViewsScenario({
      fixture,
      homeA,
      target,
      homeB,
      alice,
      gameId,
      bob,
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
    })
    const { viewsSetup1, bobStageMoveId } = viewsScenario12
    let { views, stage } = viewsScenario12
    const aliceArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
      arrivedAtTick: 3,
    })
    const bobJourney = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: playerIdFor(bob), movementSubmissionId: bobStageMoveId }),
    )
    Assert.isDefined(aliceArrival)
    Assert.isDefined(bobJourney)
    expect(aliceArrival.arrivedAtTick).toBe(3)
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 35).id).toBe(aliceArrival.id)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views

    const aliceStationaryScenario2 = await prepareAliceStationaryScenario({
      ...viewsScenario12,
      stage,
      bobJourney,
      views,
      target,
      homeB,
      alice,
      gameId,
      homeA,
      bob,
      clients,
      server,
      clock,
      turnsRepository,
      turnProcessor,
    })
    const { aliceStationarySetup2, aliceStationary, bobAssaultFleet, moveActionId, turn, colonizeResultSetup3 } = aliceStationaryScenario2
    views = await readViews(clients, gameId)
    expect(required(views[0]).turn).toBe(turn + 1)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 19).id).toBe(aliceStationary.id)
    expect(required(views[1]).fleets.find(({ id }) => id === bobAssaultFleet.id)).toBeUndefined()
    const persistedJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(persistedJourney)

    assertPersistedJourney({
      ...viewsSetup1,
      ...aliceStationarySetup2,
      persistedJourney,
      target,
      homeA,
      views,
    })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === turn + 1)
    Assert.isDefined(savedNextTurn)

    verifyPublicState({
      ...viewsSetup1,
      ...aliceStationarySetup2,
      ...colonizeResultSetup3,
      savedNextTurn,
      gameId,
      target,
      views,
      persistedJourney,
      homeA,
    })
  })

  it("should claim a public35-force source after Move15 while preserving the Q-bound remainder15", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const playerSetup4 = await createPlayerSetup({ server })
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target, routeDistance, buildActionId, stageActionId } =
      playerSetup4
    let { view } = playerSetup4
    const staged = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients: [player],
      gameId,
      turn: view.turn,
    })
    view = required(staged.views[0])

    const stagedArrivalSetup5 = await createStagedArrivalSetup({ ...playerSetup4, staged, view, server })
    const { stagedArrival, moveActionId, colonizeActionId, workerInput, replay } = stagedArrivalSetup5

    const journeySetup6 = await createJourneySetup({
      ...playerSetup4,
      ...stagedArrivalSetup5,
      view,
    })
    const { journey, updatedVerifyJourney } = journeySetup6
    view = updatedVerifyJourney.view

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-19 public Move15+stationary Colonize20 success receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      staging: { buildActionId, stageActionId, strength: 35, actualArrivalTick: stagedArrival.arrivedAtTick },
      selected: { move15: moveActionId, stationaryColonize20: colonizeActionId },
      result: {
        owner: playerIdFor(player),
        stationary35Consumed: true,
        journey: { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd },
      },
      payment: { influence: 28, fuel: 1, remaining: { influence: 72, fuel: 9 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })
})

async function createViewsSetup(input: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = input.fixture.views
  const routeDistance = Math.hypot(input.homeA.x - input.target.x, input.homeA.y - input.target.y)
  const enemyDistance = Math.hypot(input.homeB.x - input.target.x, input.homeB.y - input.target.y)
  expect(routeDistance).toBeCloseTo(1.2645395167985714, 12)
  expect(enemyDistance).toBeCloseTo(18.852953053708077, 12)
  expect(input.target.ownerPlayerId).toBeNull()

  await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: input.homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: input.homeB.id },
    selectedInputs: {},
  })
  const stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, input.homeA.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, input.homeB.id, 10)

  await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: aliceSource.id, planet: input.target.id },
    selectedInputs: { strength: 35 },
  })
  return { views, routeDistance, stage, bobSource }
}

async function createAliceStationarySetup(input: CreateAliceStationarySetupInput): Promise<CreateAliceStationarySetupResult> {
  expect(input.stage.resolved.fleets[input.bobJourney.id]?.arrivedAtTick).toBe(18)
  const aliceStationary = getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.target.id, 35)
  const bobAssaultFleet = getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.target.id, 1)
  expect(getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.homeB.id, 9).strength).toBe(9)
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()

  const moveActionId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(input.views[0]),
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: aliceStationary.id, planet: input.homeA.id },
    selectedInputs: { strength: 15 },
  })
  const colonizeActionId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(input.views[0]),
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: aliceStationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  const assaultActionId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(input.views[1]),
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: { station: bobAssaultFleet.id, battlePlanet: input.target.id },
    selectedInputs: {},
  })
  const selectedViews = await readViews(input.clients, input.gameId)

  assertRequired({ ...input, selectedViews, moveActionId, aliceStationary, colonizeActionId, assaultActionId, bobAssaultFleet })

  const turn = required(selectedViews[0]).turn
  const workerInput = await captureWorkerInput({ ...input, turn })
  const replay = replayWorkerInputWithState(workerInput)
  Assert.isSuccess(replay.resolved)
  expect(workerInput.submittedActions).toHaveLength(3)
  expect(workerInput.submittedActions.find(({ id }) => id === moveActionId)).toMatchObject({
    selectedTargets: { fleet: aliceStationary.id, planet: input.homeA.id },
    selectedInputs: { strength: 15 },
  })
  expect(workerInput.submittedActions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    selectedTargets: { fleet: aliceStationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  expect(workerInput.submittedActions.find(({ id }) => id === assaultActionId)).toMatchObject({
    selectedTargets: { station: bobAssaultFleet.id, battlePlanet: input.target.id },
    selectedInputs: {},
  })
  return { aliceStationary, bobAssaultFleet, moveActionId, colonizeActionId, assaultActionId, turn, workerInput, replay }
}

async function createColonizeResultSetup(input: CreateColonizeResultSetupInput): Promise<CreateColonizeResultSetupResult> {
  Assert.isSuccess(input.replay.resolved)
  const moveResult = input.replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === input.moveActionId)
  Assert.isSuccess(input.replay.resolved)
  const colonizeResult = input.replay.resolved.value.resolvedActions.find(
    ({ submittedAction }) => submittedAction.id === input.colonizeActionId,
  )
  Assert.isSuccess(input.replay.resolved)
  const assaultResult = input.replay.resolved.value.resolvedActions.find(
    ({ submittedAction }) => submittedAction.id === input.assaultActionId,
  )
  Assert.isDefined(moveResult)
  Assert.isDefined(colonizeResult)
  Assert.isDefined(assaultResult)
  expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
  expect(assaultResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.planets[input.target.id]?.ownerPlayerId).toBeNull()
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.fleets[input.aliceStationary.id]?.strength).toBe(19)
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.fleets[input.bobAssaultFleet.id]).toBeUndefined()
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.removedFleetIds).toContain(input.bobAssaultFleet.id)
  Assert.isSuccess(input.replay.resolved)
  const outgoingJourney = Object.values(input.replay.resolved.value.fleets).find(
    ({ movement }) => movement?.submission.id === input.moveActionId,
  )
  Assert.isDefined(outgoingJourney)
  expect(outgoingJourney).toMatchObject({
    ownerPlayerId: playerIdFor(input.alice),
    strength: 15,
    originPlanetId: input.target.id,
    destinationPlanetId: input.homeA.id,
    movement: { speed: 0.1, submission: { id: input.moveActionId }, pendingArrivalEffects: [] },
  })
  expect(outgoingJourney.distanceToEnd).toBeCloseTo(input.routeDistance - 0.1, 12)
  expect(input.replay.nextRngState).toStrictEqual(input.workerInput.rngState)

  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  return { colonizeResult }
}

async function createPlayerSetup(input: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
  const rulesetsRepository = new RulesetsRepository({ db: input.server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
  const player = await input.server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000046" })
  const { createdGameId: gameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicColonizationBudgetRuleset.id,
      nbSeats: 1,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: new Date() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.server.database, clock })
  let view = await player.client.gameplay.getPlayerView.query({ gameId })
  const home = getHome(view)
  const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
  Assert.isDefined(target)
  expect(home.coordinates).toBe("45:98:30")
  expect(target.coordinates).toBe("55:07:50")
  const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
  expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()

  const buildActionId = await submitAction({
    client: player.client,
    gameId,
    view,
    actionDefinitionId: PublicBudgetBuild35.id,
    selectedTargets: { planet: home.id },
    selectedInputs: {},
  })
  view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  const source = getFleetAt(view, view.player.id, home.id, 35)
  const stageActionId = await submitAction({
    client: player.client,
    gameId,
    view,
    actionDefinitionId: PublicBudgetStageFleet.id,
    selectedTargets: { fleet: source.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  return { player, gameId, clock, turnProcessor, turnsRepository, view, home, target, routeDistance, buildActionId, stageActionId }
}

async function createStagedArrivalSetup(input: CreateStagedArrivalSetupInput): Promise<CreateStagedArrivalSetupResult> {
  const stagedArrival = Object.values(input.staged.resolved.fleets).find((fleet) =>
    matchesPublicFleet(fleet, { ownerPlayerId: input.view.player.id, originPlanetId: input.target.id, strength: 35 }),
  )
  Assert.isDefined(stagedArrival)
  expect(stagedArrival.arrivedAtTick).toBeDefined()
  const stationary = getFleetAt(input.view, input.view.player.id, input.target.id, 35)
  expect(stationary.id).toBe(stagedArrival.id)

  const moveActionId = await submitAction({
    ...input,
    client: input.player.client,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: stationary.id, planet: input.home.id },
    selectedInputs: { strength: 15 },
  })
  const colonizeActionId = await submitAction({
    ...input,
    client: input.player.client,
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: stationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  const selectedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(selectedView.actions.find(({ id }) => id === moveActionId)).toMatchObject({
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: stationary.id, planet: input.home.id },
    selectedInputs: { strength: 15 },
  })
  expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: stationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

  const workerInput = await captureWorkerInput({ ...input, turn: selectedView.turn })
  const replay = replayWorkerInputWithState(workerInput)
  Assert.isSuccess(replay.resolved)
  expect(workerInput.submittedActions).toHaveLength(2)
  expect(findPlayerAction(workerInput.submittedActions, moveActionId, playerIdFor(input.player))).toMatchObject({
    selectedTargets: { fleet: stationary.id, planet: input.home.id },
    selectedInputs: { strength: 15 },
  })
  return { stagedArrival, stationary, moveActionId, colonizeActionId, selectedView, workerInput, replay }
}

async function createJourneySetup(input: CreateJourneySetupInput): Promise<CreateJourneySetupResult> {
  expect(findPlayerAction(input.workerInput.submittedActions, input.colonizeActionId, playerIdFor(input.player))).toMatchObject({
    selectedTargets: { fleet: input.stationary.id, planet: input.target.id },
    selectedInputs: {},
  })
  Assert.isSuccess(input.replay.resolved)
  const moveResult = findResolvedAction(input.replay.resolved.value.resolvedActions, input.moveActionId, playerIdFor(input.player))

  Assert.isSuccess(input.replay.resolved)
  const colonizeResult = findResolvedAction(input.replay.resolved.value.resolvedActions, input.colonizeActionId, playerIdFor(input.player))

  Assert.isDefined(moveResult)
  Assert.isDefined(colonizeResult)
  expect(moveResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
  expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.removedFleetIds).toContain(input.stationary.id)
  Assert.isSuccess(input.replay.resolved)
  expect(input.replay.resolved.value.fleets[input.stationary.id]).toBeUndefined()
  Assert.isSuccess(input.replay.resolved)
  const journey = findPublicFleet(Object.values(input.replay.resolved.value.fleets), {
    ownerPlayerId: playerIdFor(input.player),
    originPlanetId: input.target.id,
    destinationPlanetId: input.home.id,
    strength: 15,
    movementSubmissionId: input.moveActionId,
  })
  Assert.isDefined(journey)

  Assert.isSuccess(input.replay.resolved)
  const assertJourneyPhase6Value1 = input.replay.resolved.value

  const updatedVerifyJourney = await assertJourney({ ...input, journey, assertJourneyPhase6Value1 })
  return { journey, updatedVerifyJourney }
}

type CreateViewsSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  homeA: Planet
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type CreateViewsSetupResult = {
  views: PlayerView[]
  routeDistance: number
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobSource: Fleet
}

type CreateAliceStationarySetupInput = {
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobJourney: Fleet
  views: PlayerView[]
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

type CreateAliceStationarySetupResult = {
  aliceStationary: Fleet
  bobAssaultFleet: Fleet
  moveActionId: string
  colonizeActionId: string
  assaultActionId: string
  turn: number
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
}

type CreateColonizeResultSetupInput = {
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  moveActionId: string
  colonizeActionId: string
  assaultActionId: string
  target: Planet
  aliceStationary: Fleet
  bobAssaultFleet: Fleet
  alice: AuthenticatedApiClient
  homeA: Planet
  routeDistance: number
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

type CreateColonizeResultSetupResult = { colonizeResult: ResolvedTurnState["resolvedActions"][number] }

type CreatePlayerSetupInput = { server: ConcurrencyTestApiServer }

type CreatePlayerSetupResult = {
  player: AuthenticatedApiClient
  gameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  view: PlayerView
  home: Planet
  target: Planet
  routeDistance: number
  buildActionId: string
  stageActionId: string
}

type CreateStagedArrivalSetupInput = {
  staged: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  view: PlayerView
  target: Planet
  player: AuthenticatedApiClient
  gameId: GameId
  home: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

type CreateStagedArrivalSetupResult = {
  stagedArrival: ResolutionFleet
  stationary: Fleet
  moveActionId: string
  colonizeActionId: string
  selectedView: PlayerView
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
}

type CreateJourneySetupInput = {
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  colonizeActionId: string
  player: AuthenticatedApiClient
  stationary: Fleet
  target: Planet
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  moveActionId: string
  home: Planet
  routeDistance: number
  turnProcessor: TurnProcessor
  view: PlayerView
  gameId: GameId
  selectedView: PlayerView
}

type CreateJourneySetupResult = { journey: ResolutionFleet; updatedVerifyJourney: AssertJourneyResult }

function verifyPublicState(input: VerifyPublicStateInput): void {
  assertPersistedNextRngState2({ ...input })
}

type VerifyPublicStateInput = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: number
  target: Planet
  routeDistance: number
  aliceStationary: Fleet
  bobAssaultFleet: Fleet
  moveActionId: string
  colonizeActionId: string
  assaultActionId: string
  views: PlayerView[]
  colonizeResult: Readonly<{ submittedAction: ReturnType<typeof createSubmittedActionStub>; actionOutcomes: readonly EffectOutcome[] }>
  persistedJourney: Fleet
  homeA: Planet
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

async function prepareViewsScenario(input: PrepareViewsScenarioInput): Promise<PrepareViewsScenarioResult> {
  const viewsSetup1 = await createViewsSetup({ ...input })
  const { bobSource } = viewsSetup1
  let { views, stage } = viewsSetup1
  const bobStageMoveId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: bobSource.id, planet: input.target.id },
    selectedInputs: { strength: 1 },
  })
  stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  return { viewsSetup1, views, stage, bobStageMoveId }
}

async function prepareAliceStationaryScenario(input: PrepareAliceStationaryScenarioInput): Promise<PrepareAliceStationaryScenarioResult> {
  const aliceStationarySetup2 = await createAliceStationarySetup({ ...input })
  const { aliceStationary, bobAssaultFleet, moveActionId, turn } = aliceStationarySetup2

  const colonizeResultSetup3 = await createColonizeResultSetup({ ...input, ...input.viewsSetup1, ...aliceStationarySetup2 })

  return {
    aliceStationarySetup2,
    aliceStationary,
    bobAssaultFleet,
    moveActionId,
    turn,
    colonizeResultSetup3,
  }
}

type PrepareViewsScenarioInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  homeA: Planet
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

type PrepareViewsScenarioResult = {
  viewsSetup1: CreateViewsSetupResult
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobStageMoveId: string
}

type PrepareAliceStationaryScenarioInput = {
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobJourney: Fleet
  views: PlayerView[]
  target: Planet
  homeB: Planet
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  viewsSetup1: CreateViewsSetupResult
  turnProcessor: TurnProcessor
}

type PrepareAliceStationaryScenarioResult = {
  aliceStationarySetup2: CreateAliceStationarySetupResult
  aliceStationary: Fleet
  bobAssaultFleet: Fleet
  moveActionId: string
  turn: number
  colonizeResultSetup3: CreateColonizeResultSetupResult
}
