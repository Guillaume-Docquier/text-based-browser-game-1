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
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()

    // Act & Assert
    const playerScenario1 = await preparePlayerScenario({ server })
    const { playerSetup1, player, gameId, clock, turnProcessor, turnsRepository, home, target, replacementTarget, stationary } =
      playerScenario1
    let { view } = playerScenario1
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

    const exact35ViewSetup2 = await createExact35ViewSetup({
      ...playerSetup1,
      moveAction,
      colonizeAction,
      submitMove,
      submitColonize,
      currentView,
      replacementSource,
      cancelAction,
      secondColonizeAction,
    })
    const { exact35View } = exact35ViewSetup2
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

    const fullForceSetup3 = await createFullForceSetup({ ...playerSetup1, view, currentView, server })
    const { exact40WorkerInput, exact40Replay } = fullForceSetup3
    Assert.isSuccess(exact40Replay.resolved)
    expect(exact40WorkerInput.submittedActions).toHaveLength(2)
    Assert.isSuccess(exact40Replay.resolved)

    await verifyExact40({
      ...playerScenario1,
      ...playerSetup1,
      ...fullForceSetup3,
      fullForceSetup3,
      server,
      replacementSource,
    })
  })
})

function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect({ id: input.home.id, name: input.home.name, coordinates: input.home.coordinates, x: input.home.x, y: input.home.y }).toStrictEqual(
    {
      id: "78821e36-f066-5df0-adbd-19785571d245",
      name: "planet 278494",
      coordinates: "45:98:30",
      x: 58.43842436611536,
      y: 49.61917707239218,
    },
  )
  expect({
    id: input.target.id,
    name: input.target.name,
    coordinates: input.target.coordinates,
    x: input.target.x,
    y: input.target.y,
  }).toStrictEqual({
    id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
    name: "planet 684163",
    coordinates: "55:07:50",
    x: 57.77998524757335,
    y: 50.556704120958045,
  })
  expect({
    id: input.replacementTarget.id,
    name: input.replacementTarget.name,
    coordinates: input.replacementTarget.coordinates,
    x: input.replacementTarget.x,
    y: input.replacementTarget.y,
  }).toStrictEqual({
    id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
    name: "planet 499054",
    coordinates: "45:98:25",
    x: 58.43825730690875,
    y: 49.61937512280339,
  })
  expect(Math.hypot(input.home.x - input.target.x, input.home.y - input.target.y)).toBeCloseTo(1.1456435045942517, 12)
  expect(input.target.ownerPlayerId).toBeNull()
  expect(input.view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(input.view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(input.view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
}

async function assertCombinedReservation(input: AssertCombinedReservationInput): Promise<void> {
  const assertCombinedReservation = (selected: PlayerView): void => {
    expect(selected.actions.find(({ id }) => id === input.moveAction.id)).toMatchObject({
      selectedTargets: { fleet: input.stationary.id, planet: input.home.id },
      selectedInputs: { strength: 15 },
    })
    expect(selected.actions.find(({ id }) => id === input.colonizeAction.id)).toMatchObject({
      selectedTargets: { fleet: input.stationary.id, planet: input.target.id },
      selectedInputs: {},
    })
    expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(selected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(selected.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  }

  await verifySourceReplacementView({ ...input, assertCombinedReservation })

  await verifyEditedView({ ...input })

  await verifyCancelledView({ ...input })
}

function assertExact40PersistedRngState(input: AssertExact40PersistedRngStateInput): void {
  const exact40PersistedRngState = {
    generatorState: input.exact40SavedNextTurn.rngGeneratorState,
    spareNormal: input.exact40SavedNextTurn.rngSpareNormal,
  }
  expect(exact40PersistedRngState).toStrictEqual(input.exact40Replay.nextRngState)
  logReceipt("[C3-18 public API aggregate budget receipt]", {
    gameId: input.gameId,
    seed: 1234,
    route: { from: input.home.coordinates, to: input.target.coordinates, distance: 1.1456435045942517 },
    startingBalances: { influence: 100, fuel: 10, colony: 0 },
    force35: { move15PlusStationary20: { influenceUncommitted: 72, fuelUncommitted: 9 }, rejectedMove16: true },
    sourceReplacement: {
      sourceP: { planet: input.target.coordinates, force: input.stationary.strength, moveReservation: 15, remaining: 20 },
      sourceQ: {
        planet: input.replacementTarget.coordinates,
        force: input.replacementSource.strength,
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
      loadedTurn: input.exact40WorkerInput.turn,
      loadedActions: input.exact40WorkerInput.submittedActions.map(({ id, selectedTargets }) => ({ id, selectedTargets })),
      outcomes: input.exact40ColonizeOutcomes,
      persistedOwner: getPlanets(input.exact40CompletedView).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      persistedFleetStrength: getFleetAt(input.exact40CompletedView, input.exact40View.player.id, input.target.id, 20).strength,
      resources: {
        influence: input.exact40CompletedView.resources[ResourceType.INFLUENCE].total,
        fuel: input.exact40CompletedView.resources[ResourceType.FUEL].total,
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

async function createPlayerSetup(input: CreatePlayerSetupInput): Promise<CreatePlayerSetupResult> {
  const rulesetsRepository = new RulesetsRepository({ db: input.server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
  const player = await input.server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000091" })
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

async function createExact35ViewSetup(input: CreateExact35ViewSetupInput): Promise<CreateExact35ViewSetupResult> {
  await assertCombinedReservation({ ...input })

  const exact35View = await input.currentView()
  expect(exact35View.actions.find(({ id }) => id === input.colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: input.stationary.id,
    planet: input.target.id,
  })
  expect(exact35View.actions.find(({ id }) => id === input.secondColonizeAction.id)?.selectedTargets).toBeNull()
  expect(exact35View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
  await input.cancelAction({ actionId: input.colonizeAction.id })

  const buildFiveAction = exact35View.actions.find(({ id }) => id === "PUBLIC_BUDGET_BUILD5")
  Assert.isDefined(buildFiveAction)
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: exact35View.turn,
    submittedActionTargets: {
      actionId: buildFiveAction.id,
      selectedTargets: { planet: input.home.id },
      selectedInputs: {},
    },
  })
  return { exact35View }
}

async function createFullForceSetup(input: CreateFullForceSetupInput): Promise<CreateFullForceSetupResult> {
  const fullForce = getFleetAt(input.view, input.view.player.id, input.target.id, 40)
  expect(getPlanets(input.view).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  expect(input.view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(input.view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

  const currentColonizeActions = input.view.actions.filter((action) => isColonizeDefinitionId(action.actionDefinitionId))
  const fullColonizeAction = currentColonizeActions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
  const fullSecondColonizeAction = currentColonizeActions.find(
    ({ actionDefinitionId }) => actionDefinitionId === PublicBudgetSecondColonizeHere.id,
  )
  Assert.isDefined(fullColonizeAction)
  Assert.isDefined(fullSecondColonizeAction)
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.view.turn,
    submittedActionTargets: {
      actionId: fullColonizeAction.id,
      selectedTargets: { fleet: fullForce.id, planet: input.target.id },
      selectedInputs: {},
    },
  })
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.view.turn,
    submittedActionTargets: {
      actionId: fullSecondColonizeAction.id,
      selectedTargets: { fleet: fullForce.id, planet: input.target.id },
      selectedInputs: {},
    },
  })
  const exact40View = await input.currentView()
  expect(exact40View.actions.find(({ id }) => id === fullColonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: fullForce.id,
    planet: input.target.id,
  })
  expect(exact40View.actions.find(({ id }) => id === fullSecondColonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: fullForce.id,
    planet: input.target.id,
  })
  expect(exact40View.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 50 })
  expect(exact40View.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  const exact40WorkerInput = await captureWorkerInput({ ...input, turn: exact40View.turn })
  const exact40Replay = replayWorkerInputWithState(exact40WorkerInput)
  return { fullForce, fullColonizeAction, fullSecondColonizeAction, exact40View, exact40WorkerInput, exact40Replay }
}

async function createExact40ColonizeOutcomesSetup(
  input: CreateExact40ColonizeOutcomesSetupInput,
): Promise<CreateExact40ColonizeOutcomesSetupResult> {
  const exact40ColonizeOutcomes = input.exact40Results.flatMap(({ actionOutcomes }) => actionOutcomes)
  expect(exact40ColonizeOutcomes.filter((outcome) => hasResolvedResult(outcome, " colonized Planet "))).toHaveLength(1)
  expect(exact40ColonizeOutcomes.filter((outcome) => outcome.type === "PREVENTED")).toHaveLength(1)
  Assert.isSuccess(input.exact40Replay.resolved)
  Assert.isSuccess(input.exact40Replay.resolved)
  expect(input.exact40Replay.resolved.value.planets[input.target.id]?.ownerPlayerId).toBe(input.exact40View.player.id)
  Assert.isSuccess(input.exact40Replay.resolved)
  Assert.isSuccess(input.exact40Replay.resolved)
  expect(input.exact40Replay.resolved.value.fleets[input.fullForce.id]).toMatchObject({
    id: input.fullForce.id,
    ownerPlayerId: input.exact40View.player.id,
    originPlanetId: input.target.id,
    strength: 20,
  })
  Assert.isSuccess(input.exact40Replay.resolved)
  Assert.isSuccess(input.exact40Replay.resolved)
  expect(input.exact40Replay.resolved.value.fleets[input.fullForce.id]?.movement).toBeUndefined()
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const exact40CompletedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(exact40CompletedView.turn).toBe(input.exact40View.turn + 1)
  expect(getPlanets(exact40CompletedView).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBe(input.exact40View.player.id)
  expect(getFleetAt(exact40CompletedView, input.exact40View.player.id, input.target.id, 20).id).toBe(input.fullForce.id)
  expect(exact40CompletedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
  expect(exact40CompletedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  for (const actionId of [input.fullColonizeAction.id, input.fullSecondColonizeAction.id]) {
    expect(exact40CompletedView.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
  const exact40SavedTurns = await input.server.database
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.gameId, typedParse(GameIdSchema, input.gameId)))
  const exact40SavedNextTurn = exact40SavedTurns.find(({ turn: candidateTurn }) => candidateTurn === input.exact40WorkerInput.turn + 1)
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

async function verifyExact40(input: VerifyExact40Input): Promise<void> {
  Assert.isSuccess(input.exact40Replay.resolved)
  const exact40Resolved = input.exact40Replay.resolved.value
  const exact40Results = [input.fullColonizeAction.id, input.fullSecondColonizeAction.id].map((actionId) => {
    const result = exact40Resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === actionId)
    Assert.isDefined(result)
    return result
  })

  const exact40ColonizeOutcomesSetup4 = await createExact40ColonizeOutcomesSetup({
    ...input.playerSetup1,
    ...input.fullForceSetup3,
    exact40Results,
    server: input.server,
  })

  assertExact40PersistedRngState({ ...input, ...exact40ColonizeOutcomesSetup4 })
}

async function verifySourceReplacementView(input: VerifySourceReplacementViewInput): Promise<void> {
  await input.submitMove({ strength: 15 })
  await input.submitColonize({ actionId: input.colonizeAction.id })
  input.assertCombinedReservation(await input.currentView())

  await input.submitColonize({
    actionId: input.colonizeAction.id,
    selectedFleetId: input.replacementSource.id,
    selectedPlanetId: input.replacementTarget.id,
  })
  const sourceReplacementView = await input.currentView()
  expect(sourceReplacementView.actions.find(({ id }) => id === input.moveAction.id)).toMatchObject({
    selectedTargets: { fleet: input.stationary.id, planet: input.home.id },
    selectedInputs: { strength: 15 },
  })
  expect(sourceReplacementView.actions.find(({ id }) => id === input.colonizeAction.id)).toMatchObject({
    selectedTargets: { fleet: input.replacementSource.id, planet: input.replacementTarget.id },
    selectedInputs: {},
  })
  expect(sourceReplacementView.fleets.find(({ id }) => id === input.stationary.id)?.strength).toBe(35)
  expect(sourceReplacementView.fleets.find(({ id }) => id === input.replacementSource.id)?.strength).toBe(30)
  expect(sourceReplacementView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
  expect(sourceReplacementView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  await input.submitColonize({ actionId: input.colonizeAction.id })

  await input.cancelAction({ actionId: input.moveAction.id })
  await input.cancelAction({ actionId: input.colonizeAction.id })
  await input.submitColonize({ actionId: input.colonizeAction.id })
  await input.submitMove({ strength: 15 })
  input.assertCombinedReservation(await input.currentView())

  await input.submitMove({ strength: 14 })
}

async function verifyEditedView(input: VerifyEditedViewInput): Promise<void> {
  let editedView = await input.currentView()
  expect(editedView.actions.find(({ id }) => id === input.moveAction.id)).toMatchObject({
    selectedTargets: { fleet: input.stationary.id, planet: input.home.id },
    selectedInputs: { strength: 14 },
  })
  expect(editedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
  expect(editedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  await expect(input.submitMove({ strength: 16 })).rejects.toThrow(
    "Invalid action submission, targets are invalid or costs cannot be paid.",
  )
  editedView = await input.currentView()
  expect(editedView.actions.find(({ id }) => id === input.moveAction.id)?.selectedInputs).toStrictEqual({ strength: 14 })
  expect(editedView.actions.find(({ id }) => id === input.colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: input.stationary.id,
    planet: input.target.id,
  })

  await input.cancelAction({ actionId: input.moveAction.id })
}

async function verifyCancelledView(input: VerifyCancelledViewInput): Promise<void> {
  let cancelledView = await input.currentView()
  expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 75 })
  expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(cancelledView.actions.find(({ id }) => id === input.colonizeAction.id)?.selectedTargets).toStrictEqual({
    fleet: input.stationary.id,
    planet: input.target.id,
  })
  await input.cancelAction({ actionId: input.colonizeAction.id })

  await input.submitMove({ strength: 15 })
  await input.submitColonize({ actionId: input.colonizeAction.id })
  await input.cancelAction({ actionId: input.colonizeAction.id })
  cancelledView = await input.currentView()
  expect(cancelledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 97 })
  expect(cancelledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
  expect(cancelledView.actions.find(({ id }) => id === input.moveAction.id)?.selectedInputs).toStrictEqual({ strength: 15 })
  await input.cancelAction({ actionId: input.moveAction.id })

  await input.submitColonize({ actionId: input.colonizeAction.id })
  await expect(input.submitColonize({ actionId: input.secondColonizeAction.id })).rejects.toThrow(
    "Invalid action submission, targets are invalid or costs cannot be paid.",
  )
}

type VerifyExact40Input = {
  exact40Replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  fullColonizeAction: Action
  fullSecondColonizeAction: Action
  playerSetup1: CreatePlayerSetupResult
  fullForceSetup3: CreateFullForceSetupResult
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

async function preparePlayerScenario(input: PreparePlayerScenarioInput): Promise<PreparePlayerScenarioResult> {
  const playerSetup1 = await createPlayerSetup({ server: input.server })
  const { player, gameId, clock, turnProcessor, turnsRepository, home, target, replacementTarget, stationary, buildThirtyAction } =
    playerSetup1
  let { view } = playerSetup1
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
    playerSetup1,
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

type PreparePlayerScenarioInput = { server: ConcurrencyTestApiServer }

type PreparePlayerScenarioResult = {
  playerSetup1: CreatePlayerSetupResult
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
