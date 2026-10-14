import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import type { Planet, Action, Fleet, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { BudgetSelectionHarness } from "#tests/colonization/BudgetSelectionHarness.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
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
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  PublicBudgetSecondColonizeHere,
  PublicColonizationBudgetRuleset,
  logReceipt,
  hasResolvedResult,
  isColonizeDefinitionId,
  isUnselectedActionWithDefinition,
} from "../../tests/colonization/gameplay.colonization.ts"

describe("public Colonization worker companions", () => {
  it("should preserve the public 15+20 stationary Colonize budget through selection, replacement, cancellation, and the exact40 boundary", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const createCreatePlayerSetupPhase1ResultSetupPhase1Result = await createCreatePlayerSetupResultSetup({ server })
    const {
      createPlayerSetupPhase1Result,
      player,
      gameId,
      clock,
      turnProcessor,
      turnsRepository,
      home,
      target,
      replacementTarget,
      stationary,
    } = createCreatePlayerSetupPhase1ResultSetupPhase1Result
    let { view } = createCreatePlayerSetupPhase1ResultSetupPhase1Result
    const replacementSource = getFleetAt(view, view.player.id, replacementTarget.id, 30)
    expect(getFleetAt(view, view.player.id, target.id, 35).strength).toBe(35)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getPlanets(view).find(({ id }) => id === replacementTarget.id)?.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const moveAction = view.actions.find((action) => isUnselectedActionWithDefinition(action, MoveFleetStandard.id))

    const colonizeActions = view.actions.filter((action) => isColonizeDefinitionId(action.actionDefinitionId))
    const colonizeAction = colonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
    const secondColonizeAction = colonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetSecondColonizeHere.id)
    Assert.isDefined(moveAction)
    Assert.isDefined(colonizeAction)
    Assert.isDefined(secondColonizeAction)

    const { submitMove, submitColonize, cancelAction, currentView } = new BudgetSelectionHarness({
      client: player.client,
      gameId,
      readView: (): PlayerView => view,
      stationary,
      target,
      home,
      moveAction,
    })

    const createExact35ViewSetupPhase2Result = await createExact35ViewSetup({
      ...createPlayerSetupPhase1Result,
      moveAction,
      colonizeAction,
      submitMove,
      submitColonize,
      currentView,
      replacementSource,
      cancelAction,
      secondColonizeAction,
    })
    const { exact35View } = createExact35ViewSetupPhase2Result
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: exact35View.turn })
    const fiveStrengthFleet = getFleetAt(view, view.player.id, home.id, 5)
    const nextStageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
    Assert.isDefined(nextStageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: nextStageAction.id,
        selectedTargets: { fleet: fiveStrengthFleet.id, planet: target.id },
        selectedInputs: { strength: 5 },
      },
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })

    const createFullForceSetupPhase3Result = await createFullForceSetup({ ...createPlayerSetupPhase1Result, view, currentView, server })
    const { exact40WorkerInput, exact40Replay } = createFullForceSetupPhase3Result
    Assert.isSuccess(exact40Replay.resolved)
    expect(exact40WorkerInput.submittedActions).toHaveLength(2)
    Assert.isSuccess(exact40Replay.resolved)

    await verifyExact40({
      ...createCreatePlayerSetupPhase1ResultSetupPhase1Result,
      ...createPlayerSetupPhase1Result,
      ...createFullForceSetupPhase3Result,
      createFullForceSetupPhase3Result,
      server,
      replacementSource,
    })
  })
})

function assertScenarioState2({ home, target, replacementTarget, view }: AssertScenarioState2Input): void {
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
  expect({
    id: replacementTarget.id,
    name: replacementTarget.name,
    coordinates: replacementTarget.coordinates,
    x: replacementTarget.x,
    y: replacementTarget.y,
  }).toStrictEqual({
    id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
    name: "planet 499054",
    coordinates: "45:98:25",
    x: 58.43825730690875,
    y: 49.61937512280339,
  })
  expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeCloseTo(1.1456435045942517, 12)
  expect(target.ownerPlayerId).toBeNull()
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
}

async function assertCombinedReservation({
  moveAction,
  stationary,
  home,
  colonizeAction,
  target,
  submitMove,
  submitColonize,
  currentView,
  replacementSource,
  replacementTarget,
  cancelAction,
  secondColonizeAction,
}: AssertCombinedReservationInput): Promise<void> {
  const assertCombinedReservation = (selected: PlayerView): void => {
    expect(selected.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(selected.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(selected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(selected.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  }

  await verifySourceReplacementView({
    submitMove,
    submitColonize,
    colonizeAction,
    assertCombinedReservation,
    currentView,
    replacementSource,
    replacementTarget,
    moveAction,
    stationary,
    home,
    cancelAction,
  })

  await verifyEditedView({ currentView, moveAction, stationary, home, submitMove, colonizeAction, target, cancelAction })

  await verifyCancelledView({
    currentView,
    colonizeAction,
    stationary,
    target,
    cancelAction,
    submitMove,
    submitColonize,
    moveAction,
    secondColonizeAction,
  })
}

function assertExact40PersistedRngState({
  exact40SavedNextTurn,
  exact40Replay,
  gameId,
  home,
  target,
  stationary,
  replacementTarget,
  replacementSource,
  exact40WorkerInput,
  exact40ColonizeOutcomes,
  exact40CompletedView,
  exact40View,
}: AssertExact40PersistedRngStateInput): void {
  const exact40PersistedRngState = {
    generatorState: exact40SavedNextTurn.rngGeneratorState,
    spareNormal: exact40SavedNextTurn.rngSpareNormal,
  }
  expect(exact40PersistedRngState).toStrictEqual(exact40Replay.nextRngState)
  logReceipt("[C3-18 public API aggregate budget receipt]", {
    gameId,
    seed: 1234,
    route: { from: home.coordinates, to: target.coordinates, distance: 1.1456435045942517 },
    startingBalances: { influence: 100, fuel: 10, colony: 0 },
    force35: { move15PlusStationary20: { influenceUncommitted: 72, fuelUncommitted: 9 }, rejectedMove16: true },
    sourceReplacement: {
      sourceP: { planet: target.coordinates, force: stationary.strength, moveReservation: 15, remaining: 20 },
      sourceQ: {
        planet: replacementTarget.coordinates,
        force: replacementSource.strength,
        colonizeReservation: 20,
        remaining: 10,
      },
      committedResources: { influence: 28, fuel: 1 },
    },
    cancellations: {
      moveCanceled: { influenceUncommitted: 75, fuelUncommitted: 10 },
      colonizeCanceled: { influenceUncommitted: 97, fuelUncommitted: 9 },
    },
    exactBoundary: { force35SecondColonizeRejected: true, force40TwoColonizeAccepted: true, influenceUncommitted: 50 },
    worker: {
      loadedTurn: exact40WorkerInput.turn,
      loadedActions: exact40WorkerInput.submittedActions.map(({ id, selectedTargets }) => ({ id, selectedTargets })),
      outcomes: exact40ColonizeOutcomes,
      persistedOwner: getPlanets(exact40CompletedView).find(({ id }) => id === target.id)?.ownerPlayerId,
      persistedFleetStrength: getFleetAt(exact40CompletedView, exact40View.player.id, target.id, 20).strength,
      resources: {
        influence: exact40CompletedView.resources[ResourceType.INFLUENCE].total,
        fuel: exact40CompletedView.resources[ResourceType.FUEL].total,
      },
      persistedNextRngState: exact40PersistedRngState,
    },
  })
}

type AssertScenarioState2Input = {
  home: Planet
  target: Planet
  replacementTarget: Planet
  view: PlayerView
}

type AssertCombinedReservationInput = {
  moveAction: Action
  stationary: Fleet
  home: Planet
  colonizeAction: Action
  target: Planet
  submitMove: BudgetSelectionHarness["submitMove"]
  submitColonize: BudgetSelectionHarness["submitColonize"]
  currentView: BudgetSelectionHarness["currentView"]
  replacementSource: Fleet
  replacementTarget: Planet
  cancelAction: BudgetSelectionHarness["cancelAction"]
  secondColonizeAction: Action
}

type AssertExact40PersistedRngStateInput = {
  exact40SavedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  exact40Replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  gameId: GameId
  home: Planet
  target: Planet
  stationary: Fleet
  replacementTarget: Planet
  replacementSource: Fleet
  exact40WorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  exact40ColonizeOutcomes: EffectOutcome[]
  exact40CompletedView: PlayerView
  exact40View: PlayerView
}

async function createPlayerSetup({ server }: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
  const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000091" })
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
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  let view = await player.client.gameplay.getPlayerView.query({ gameId })
  const home = getHome(view)
  const target = getPlanets(view).find(({ coordinates }) => coordinates === "55:07:50")
  const replacementTarget = getPlanets(view).find(({ coordinates }) => coordinates === "45:98:25")
  Assert.isDefined(target)
  Assert.isDefined(replacementTarget)

  assertScenarioState2({ home, target, replacementTarget, view })

  const buildAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD35")
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
  view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  const sourceAtHome = getFleetAt(view, view.player.id, home.id, 35)
  const stageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
  Assert.isDefined(stageAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: stageAction.id,
      selectedTargets: { fleet: sourceAtHome.id, planet: target.id },
      selectedInputs: { strength: 35 },
    },
  })
  view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  const stationary = getFleetAt(view, view.player.id, target.id, 35)
  const buildThirtyAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD30")
  return { player, gameId, clock, turnProcessor, turnsRepository, view, home, target, replacementTarget, stationary, buildThirtyAction }
}

async function createExact35ViewSetup({
  moveAction,
  stationary,
  home,
  colonizeAction,
  target,
  submitMove,
  submitColonize,
  currentView,
  replacementSource,
  replacementTarget,
  cancelAction,
  secondColonizeAction,
  player,
  gameId,
}: CreateExact35ViewSetupInput): Promise<CreateExact35ViewSetupResult> {
  await assertCombinedReservation({
    moveAction,
    stationary,
    home,
    colonizeAction,
    target,
    submitMove,
    submitColonize,
    currentView,
    replacementSource,
    replacementTarget,
    cancelAction,
    secondColonizeAction,
  })

  const exact35View = await currentView()
  expect(exact35View.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: stationary.id,
    planet: target.id,
  })
  expect(exact35View.actions.find(({ id }) => id === secondColonizeAction.id)?.selectedTargets).toBeNull()
  expect(exact35View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
  await cancelAction({ actionId: colonizeAction.id })

  const buildFiveAction = exact35View.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD5")
  Assert.isDefined(buildFiveAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: exact35View.turn,
    submittedActionTargets: {
      actionId: buildFiveAction.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    },
  })
  return { exact35View }
}

async function createFullForceSetup({
  view,
  target,
  player,
  gameId,
  currentView,
  server,
  clock,
  turnsRepository,
}: CreateFullForceSetupInput): Promise<CreateFullForceSetupResult> {
  const fullForce = getFleetAt(view, view.player.id, target.id, 40)
  expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

  const currentColonizeActions = view.actions.filter((action) => isColonizeDefinitionId(action.actionDefinitionId))
  const fullColonizeAction = currentColonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
  const fullSecondColonizeAction = currentColonizeActions.find(
    ({ actionDefinitionId }) => actionDefinitionId === PublicBudgetSecondColonizeHere.id,
  )
  Assert.isDefined(fullColonizeAction)
  Assert.isDefined(fullSecondColonizeAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: fullColonizeAction.id,
      selectedTargets: { fleet: fullForce.id, planet: target.id },
      selectedInputs: {},
    },
  })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: fullSecondColonizeAction.id,
      selectedTargets: { fleet: fullForce.id, planet: target.id },
      selectedInputs: {},
    },
  })
  const exact40View = await currentView()
  expect(exact40View.actions.find(({ id }) => id === fullColonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: fullForce.id,
    planet: target.id,
  })
  expect(exact40View.actions.find(({ id }) => id === fullSecondColonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: fullForce.id,
    planet: target.id,
  })
  expect(exact40View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 50 })
  expect(exact40View.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  const exact40WorkerInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: exact40View.turn,
  })
  const exact40Replay = replayWorkerInputWithState(exact40WorkerInput)
  return { fullForce, fullColonizeAction, fullSecondColonizeAction, exact40View, exact40WorkerInput, exact40Replay }
}

async function createExact40ColonizeOutcomesSetup({
  exact40Results,
  exact40Replay,
  target,
  exact40View,
  fullForce,
  turnProcessor,
  player,
  gameId,
  fullColonizeAction,
  fullSecondColonizeAction,
  server,
  exact40WorkerInput,
}: CreateExact40ColonizeOutcomesSetupInput): Promise<CreateExact40ColonizeOutcomesSetupResult> {
  const exact40ColonizeOutcomes = exact40Results.flatMap(({ actionOutcomes }) => actionOutcomes)
  expect(exact40ColonizeOutcomes.filter((outcome) => hasResolvedResult(outcome, " colonized Planet "))).toHaveLength(1)
  expect(exact40ColonizeOutcomes.filter((outcome) => outcome.type === "PREVENTED")).toHaveLength(1)
  Assert.isSuccess(exact40Replay.resolved)
  Assert.isSuccess(exact40Replay.resolved)
  expect(exact40Replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(exact40View.player.id)
  Assert.isSuccess(exact40Replay.resolved)
  Assert.isSuccess(exact40Replay.resolved)
  expect(exact40Replay.resolved.value.fleets[fullForce.id]).toMatchObject({
    id: fullForce.id,
    ownerPlayerId: exact40View.player.id,
    originPlanetId: target.id,
    strength: 20,
  })
  Assert.isSuccess(exact40Replay.resolved)
  Assert.isSuccess(exact40Replay.resolved)
  expect(exact40Replay.resolved.value.fleets[fullForce.id]?.movement).toBeUndefined()
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const exact40CompletedView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(exact40CompletedView.turn).toBe(exact40View.turn + 1)
  expect(getPlanets(exact40CompletedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(exact40View.player.id)
  expect(getFleetAt(exact40CompletedView, exact40View.player.id, target.id, 20).id).toBe(fullForce.id)
  expect(exact40CompletedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
  expect(exact40CompletedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  for (const actionId of [fullColonizeAction.id, fullSecondColonizeAction.id]) {
    expect(exact40CompletedView.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
  const exact40SavedTurns = await server.database
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
  const exact40SavedNextTurn = exact40SavedTurns.find(({ turn: candidateTurn }) => candidateTurn === exact40WorkerInput.turn + 1)
  Assert.isDefined(exact40SavedNextTurn)
  return { exact40ColonizeOutcomes, exact40CompletedView, exact40SavedNextTurn }
}

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
  replacementTarget: Planet
  stationary: Fleet
  buildThirtyAction: undefined | Action
}

type CreateExact35ViewSetupInput = {
  moveAction: Action
  stationary: Fleet
  home: Planet
  colonizeAction: Action
  target: Planet
  submitMove: BudgetSelectionHarness["submitMove"]
  submitColonize: BudgetSelectionHarness["submitColonize"]
  currentView: BudgetSelectionHarness["currentView"]
  replacementSource: Fleet
  replacementTarget: Planet
  cancelAction: BudgetSelectionHarness["cancelAction"]
  secondColonizeAction: Action
  player: AuthenticatedApiClient
  gameId: GameId
}

type CreateExact35ViewSetupResult = { exact35View: PlayerView }

type CreateFullForceSetupInput = {
  view: PlayerView
  target: Planet
  player: AuthenticatedApiClient
  gameId: GameId
  currentView: BudgetSelectionHarness["currentView"]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

type CreateFullForceSetupResult = {
  fullForce: Fleet
  fullColonizeAction: Action
  fullSecondColonizeAction: Action
  exact40View: PlayerView
  exact40WorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  exact40Replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
}

type CreateExact40ColonizeOutcomesSetupInput = {
  exact40Results: Array<
    Readonly<{ submittedAction: ReturnType<typeof createSubmittedActionStub>; actionOutcomes: readonly EffectOutcome[] }>
  >
  exact40Replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  target: Planet
  exact40View: PlayerView
  fullForce: Fleet
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: GameId
  fullColonizeAction: Action
  fullSecondColonizeAction: Action
  server: ConcurrencyTestApiServer
  exact40WorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

type CreateExact40ColonizeOutcomesSetupResult = {
  exact40ColonizeOutcomes: EffectOutcome[]
  exact40CompletedView: PlayerView
  exact40SavedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
}

async function verifyExact40({
  exact40Replay,
  fullColonizeAction,
  fullSecondColonizeAction,
  createPlayerSetupPhase1Result,
  createFullForceSetupPhase3Result,
  server,
  gameId,
  home,
  target,
  stationary,
  replacementTarget,
  replacementSource,
  exact40WorkerInput,
  exact40View,
}: VerifyExact40Input): Promise<void> {
  Assert.isSuccess(exact40Replay.resolved)
  const exact40Resolved = exact40Replay.resolved.value
  const exact40Results = [fullColonizeAction.id, fullSecondColonizeAction.id].map((actionId) => {
    const result = exact40Resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === actionId)
    Assert.isDefined(result)
    return result
  })

  const createExact40ColonizeOutcomesSetupPhase4Result = await createExact40ColonizeOutcomesSetup({
    ...createPlayerSetupPhase1Result,
    ...createFullForceSetupPhase3Result,
    exact40Results,
    server,
  })

  assertExact40PersistedRngState({
    ...createExact40ColonizeOutcomesSetupPhase4Result,
    exact40Replay,
    gameId,
    home,
    target,
    stationary,
    replacementTarget,
    replacementSource,
    exact40WorkerInput,
    exact40View,
  })
}

async function verifySourceReplacementView({
  submitMove,
  submitColonize,
  colonizeAction,
  assertCombinedReservation,
  currentView,
  replacementSource,
  replacementTarget,
  moveAction,
  stationary,
  home,
  cancelAction,
}: VerifySourceReplacementViewInput): Promise<void> {
  await submitMove({ strength: 15 })
  await submitColonize({ actionId: colonizeAction.id })
  assertCombinedReservation(await currentView())

  await submitColonize({ actionId: colonizeAction.id, selectedFleetId: replacementSource.id, selectedPlanetId: replacementTarget.id })
  const sourceReplacementView = await currentView()
  expect(sourceReplacementView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
    selectedTargets: { fleet: stationary.id, planet: home.id },
    selectedInputs: { strength: 15 },
  })
  expect(sourceReplacementView.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
    selectedTargets: { fleet: replacementSource.id, planet: replacementTarget.id },
    selectedInputs: {},
  })
  expect(sourceReplacementView.fleets.find(({ id }) => id === stationary.id)?.strength).toBe(35)
  expect(sourceReplacementView.fleets.find(({ id }) => id === replacementSource.id)?.strength).toBe(30)
  expect(sourceReplacementView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
  expect(sourceReplacementView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  await submitColonize({ actionId: colonizeAction.id })

  await cancelAction({ actionId: moveAction.id })
  await cancelAction({ actionId: colonizeAction.id })
  await submitColonize({ actionId: colonizeAction.id })
  await submitMove({ strength: 15 })
  assertCombinedReservation(await currentView())

  await submitMove({ strength: 14 })
}

async function verifyEditedView({
  currentView,
  moveAction,
  stationary,
  home,
  submitMove,
  colonizeAction,
  target,
  cancelAction,
}: VerifyEditedViewInput): Promise<void> {
  let editedView = await currentView()
  expect(editedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
    selectedTargets: { fleet: stationary.id, planet: home.id },
    selectedInputs: { strength: 14 },
  })
  expect(editedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
  expect(editedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  await expect(submitMove({ strength: 16 })).rejects.toThrow("Invalid action submission, targets are invalid or costs cannot be paid.")
  editedView = await currentView()
  expect(editedView.actions.find(({ id }) => id === moveAction.id)?.selectedInputs).toStrictEqual({ strength: 14 })
  expect(editedView.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: stationary.id,
    planet: target.id,
  })

  await cancelAction({ actionId: moveAction.id })
}

async function verifyCancelledView({
  currentView,
  colonizeAction,
  stationary,
  target,
  cancelAction,
  submitMove,
  submitColonize,
  moveAction,
  secondColonizeAction,
}: VerifyCancelledViewInput): Promise<void> {
  let cancelledView = await currentView()
  expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
  expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(cancelledView.actions.find(({ id }) => id === colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: stationary.id,
    planet: target.id,
  })
  await cancelAction({ actionId: colonizeAction.id })

  await submitMove({ strength: 15 })
  await submitColonize({ actionId: colonizeAction.id })
  await cancelAction({ actionId: colonizeAction.id })
  cancelledView = await currentView()
  expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 97 })
  expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  expect(cancelledView.actions.find(({ id }) => id === moveAction.id)?.selectedInputs).toStrictEqual({ strength: 15 })
  await cancelAction({ actionId: moveAction.id })

  await submitColonize({ actionId: colonizeAction.id })
  await expect(submitColonize({ actionId: secondColonizeAction.id })).rejects.toThrow(
    "Invalid action submission, targets are invalid or costs cannot be paid.",
  )
}

type VerifyExact40Input = {
  exact40Replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  fullColonizeAction: Action
  fullSecondColonizeAction: Action
  createPlayerSetupPhase1Result: CreatePlayerSetupResult
  createFullForceSetupPhase3Result: CreateFullForceSetupResult
  server: ConcurrencyTestApiServer
  gameId: GameId
  home: Planet
  target: Planet
  stationary: Fleet
  replacementTarget: Planet
  replacementSource: Fleet
  exact40WorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  exact40View: PlayerView
}

type VerifySourceReplacementViewInput = {
  submitMove: BudgetSelectionHarness["submitMove"]
  submitColonize: BudgetSelectionHarness["submitColonize"]
  colonizeAction: Action
  assertCombinedReservation: (selected: PlayerView) => void
  currentView: BudgetSelectionHarness["currentView"]
  replacementSource: Fleet
  replacementTarget: Planet
  moveAction: Action
  stationary: Fleet
  home: Planet
  cancelAction: BudgetSelectionHarness["cancelAction"]
}

type VerifyEditedViewInput = {
  currentView: BudgetSelectionHarness["currentView"]
  moveAction: Action
  stationary: Fleet
  home: Planet
  submitMove: BudgetSelectionHarness["submitMove"]
  colonizeAction: Action
  target: Planet
  cancelAction: BudgetSelectionHarness["cancelAction"]
}

type VerifyCancelledViewInput = {
  currentView: BudgetSelectionHarness["currentView"]
  colonizeAction: Action
  stationary: Fleet
  target: Planet
  cancelAction: BudgetSelectionHarness["cancelAction"]
  submitMove: BudgetSelectionHarness["submitMove"]
  submitColonize: BudgetSelectionHarness["submitColonize"]
  moveAction: Action
  secondColonizeAction: Action
}

async function createCreatePlayerSetupResultSetup({
  server,
}: CreateCreatePlayerSetupResultSetupInput): Promise<CreateCreatePlayerSetupResultSetupResult> {
  const createPlayerSetupPhase1Result = await createPlayerSetup({ server })
  const { player, gameId, clock, turnProcessor, turnsRepository, home, target, replacementTarget, stationary, buildThirtyAction } =
    createPlayerSetupPhase1Result
  let { view } = createPlayerSetupPhase1Result
  Assert.isDefined(buildThirtyAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: buildThirtyAction.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    },
  })
  view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  const replacementSourceAtHome = getFleetAt(view, view.player.id, home.id, 30)
  const replacementStageAction = view.actions.find(({ id }) => id === "PUBLIC_BUDGET_STAGE_FLEET")
  Assert.isDefined(replacementStageAction)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: view.turn,
    submittedActionTargets: {
      actionId: replacementStageAction.id,
      selectedTargets: { fleet: replacementSourceAtHome.id, planet: replacementTarget.id },
      selectedInputs: { strength: 30 },
    },
  })
  view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
  return {
    createPlayerSetupPhase1Result,
    player,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    home,
    target,
    replacementTarget,
    stationary,
    view,
  }
}

type CreateCreatePlayerSetupResultSetupInput = { server: ConcurrencyTestApiServer }

type CreateCreatePlayerSetupResultSetupResult = {
  createPlayerSetupPhase1Result: CreatePlayerSetupResult
  player: AuthenticatedApiClient
  gameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  home: Planet
  target: Planet
  replacementTarget: Planet
  stationary: Fleet
  view: PlayerView
}
