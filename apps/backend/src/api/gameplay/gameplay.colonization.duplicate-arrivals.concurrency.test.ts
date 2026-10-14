import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { describe, expect, it } from "vitest"
import type { Planet, PlayerView, Fleet, Action } from "#api/types.ts"
import { turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { AssertMergedFriendlyResult } from "#tests/fleet-assertions/gameplay.colonization.renamed-content.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import {
  stagePublicMergeScenario,
  getPlanets,
  getFleetAt,
  processTurn,
  captureWorkerInput,
  canonicalizeResolvedTurn,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet35,
  ColonizeFleetSpeed2,
  ColonizeFleetSpeed4,
  required,
  hasPreventedOrColonized,
  isActionSelected,
  startTogether,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertLockedView, assertRemainingAtTarget } from "../../tests/fleet-assertions/gameplay.colonization.renamed-content-2.ts"
import {
  assertMergedFriendly,
  assertPersistedNextRngState3,
  assertRaceObservation,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.ts"

describe("public Colonization worker companions", () => {
  it("should resolve duplicate public colonization arrivals once after merging and preserve order invariance", async () => {
    expect.hasAssertions()

    await using server = await ConcurrencyTestApiServer.create()

    const createClientsSetupPhase1Result = await createClientsSetup({ server })
    const { gameId, homeA, target, stagedFriendly, speed4ActionId, speed2ActionId, selectedViews, finalTurnInput } =
      createClientsSetupPhase1Result
    let { views } = createClientsSetupPhase1Result

    const createFinalReplaySetupPhase2Result = await createFinalReplaySetup({ ...createClientsSetupPhase1Result })
    const { finalReplay, reversedReplay, mergedFriendly, updatedVerifyMergedFriendly } = createFinalReplaySetupPhase2Result
    views = updatedVerifyMergedFriendly.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(selectedViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)

    assertPersistedNextRngState3({
      savedNextTurn,
      finalTurnInput,
      gameId,
      views,
      homeA,
      target,
      stagedFriendly,
      speed4ActionId,
      speed2ActionId,
      mergedFriendly,
      finalReplay,
      reversedReplay,
    })
  })

  it("should serialize aggregate Move and stationary Colonize reservations against PostgreSQL and Turn closure", async () => {
    expect.hasAssertions()

    await using server = await ConcurrencyTestApiServer.create()

    const createAliceSetupPhase3Result = await createAliceSetup({ server })
    const { alice, bob, gameId, homeA, target, arrivedView, stationary, moveAction, colonizeAction } = createAliceSetupPhase3Result

    const createRaceSetupPhase4Result = await createRaceSetup({ ...createAliceSetupPhase3Result })
    const { race, selectedMove, selectedColonize, winningAction, beforeClosure } = createRaceSetupPhase4Result
    let { selectedView } = createRaceSetupPhase4Result

    const updatedVerifyRaceObservation = await assertRaceObservation({
      selectedMove,
      selectedColonize,
      beforeClosure,
      winningAction,
      stationary,
      homeA,
      arrivedView,
      moveAction,
      target,
      colonizeAction,
      alice,
      gameId,
      bob,
      selectedView,
    })
    selectedView = updatedVerifyRaceObservation.selectedView

    const createClosureColonizeSetupPhase5Result = await createClosureColonizeSetup({ ...createAliceSetupPhase3Result, selectedView })
    const { closureColonize, closureRace, closureSubmissionStatus, claimedPlanet } = createClosureColonizeSetupPhase5Result
    const { completedView } = createClosureColonizeSetupPhase5Result

    assertRemainingAtTarget({
      completedView,
      target,
      closureSubmissionStatus,
      claimedPlanet,
      selectedView,
      closureColonize,
      gameId,
      stationary,
      race,
      beforeClosure,
      closureRace,
    })
  })
})

async function createClientsSetup({ server }: CreateClientsSetupInput): Promise<CreateClientsSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(server)
  const { alice, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
  const staged = await stagePublicMergeScenario(server, fixture)
  const views = staged.views
  const { stagedFriendly, aliceSource } = staged

  const speed4ActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed4.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 20 },
  })
  const speed2ActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed2.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 20 },
  })
  const selectedViews = await readViews(clients, gameId)
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 443 })
  expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(getFleetAt(required(selectedViews[0]), required(selectedViews[0]).player.id, homeA.id, 50).id).toBe(aliceSource.id)

  const finalTurnInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: required(selectedViews[0]).turn,
  })
  return {
    clients,
    gameId,
    turnProcessor,
    homeA,
    target,
    views,
    stagedFriendly,
    aliceSource,
    speed4ActionId,
    speed2ActionId,
    selectedViews,
    finalTurnInput,
  }
}

async function createFinalReplaySetup({
  finalTurnInput,
  speed4ActionId,
  speed2ActionId,
  stagedFriendly,
  selectedViews,
  target,
  aliceSource,
  homeA,
  turnProcessor,
  views,
  clients,
  gameId,
}: CreateFinalReplaySetupInput): Promise<CreateFinalReplaySetupResult> {
  const finalReplay = replayWorkerInputWithState(finalTurnInput)
  const reversedReplay = replayWorkerInputWithState(finalTurnInput, true)
  Assert.isSuccess(finalReplay.resolved)
  Assert.isSuccess(reversedReplay.resolved)
  expect(canonicalizeResolvedTurn(reversedReplay.resolved.value)).toStrictEqual(canonicalizeResolvedTurn(finalReplay.resolved.value))
  expect(reversedReplay.nextRngState).toStrictEqual(finalReplay.nextRngState)
  expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
  const publicReplay = finalReplay.resolved.value
  const firstOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed4ActionId))
  const secondOutcome = required(publicReplay.resolvedActions.find(({ submittedAction }) => submittedAction.id === speed2ActionId))
  expect(firstOutcome?.actionOutcomes.at(-1)).toMatchObject({
    type: "RESOLVED",
    result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength'),
  })
  expect(secondOutcome.actionOutcomes.at(-1)).toMatchObject({ type: "PREVENTED", reason: "Planet is already claimed" })
  for (const actionOutcomes of [firstOutcome.actionOutcomes, secondOutcome.actionOutcomes]) {
    expect(actionOutcomes.filter((outcome) => hasPreventedOrColonized(outcome))).toHaveLength(1)
  }
  const mergedFriendly = publicReplay.fleets[stagedFriendly.id]
  Assert.isDefined(mergedFriendly)

  const updatedVerifyMergedFriendly = await assertMergedFriendly({
    mergedFriendly,
    stagedFriendly,
    selectedViews,
    target,
    publicReplay,
    aliceSource,
    homeA,
    turnProcessor,
    views,
    clients,
    gameId,
    speed4ActionId,
    speed2ActionId,
  })
  return { finalReplay, reversedReplay, mergedFriendly, updatedVerifyMergedFriendly }
}

async function createAliceSetup({ server }: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(server)
  const { alice, bob, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
  const buildView = required(fixture.views[0])
  await submitAction({
    client: alice.client,
    gameId,
    view: buildView,
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const builtView = await processTurn({
    clock,
    turnsRepository,
    turnProcessor,
    client: alice.client,
    gameId,
    turn: buildView.turn,
  })
  const homeFleet = getFleetAt(builtView, builtView.player.id, homeA.id, 35)
  const moveToTargetId = await submitAction({
    client: alice.client,
    gameId,
    view: builtView,
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: homeFleet.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  const arrivedView = await processTurn({
    clock,
    turnsRepository,
    turnProcessor,
    client: alice.client,
    gameId,
    turn: builtView.turn,
  })
  const stationary = getFleetAt(arrivedView, arrivedView.player.id, target.id, 35)
  expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(arrivedView.actions.find(({ id }) => id === moveToTargetId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  const moveAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
  const colonizeAction = arrivedView.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizeHereTest.id)
  Assert.isDefined(moveAction)
  Assert.isDefined(colonizeAction)

  const raceGate = startTogether(2)
  return { alice, bob, gameId, turnProcessor, homeA, target, arrivedView, stationary, moveAction, colonizeAction, raceGate }
}

async function createRaceSetup({
  raceGate,
  alice,
  gameId,
  arrivedView,
  moveAction,
  stationary,
  homeA,
  colonizeAction,
  target,
}: CreateRaceSetupInput): Promise<CreateRaceSetupResult> {
  const race = await Promise.allSettled([
    (async (): Promise<void> => {
      await raceGate()
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: arrivedView.turn,
        submittedActionTargets: {
          actionId: moveAction.id,
          selectedTargets: { fleet: stationary.id, planet: homeA.id },
          selectedInputs: { strength: 16 },
        },
      })
    })(),
    (async (): Promise<void> => {
      await raceGate()
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: arrivedView.turn,
        submittedActionTargets: {
          actionId: colonizeAction.id,
          selectedTargets: { fleet: stationary.id, planet: target.id },
          selectedInputs: {},
        },
      })
    })(),
  ])
  expect(race.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
  expect(race.filter(({ status }) => status === "rejected")).toHaveLength(1)

  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const selectedMove = selectedView.actions.find(({ id }) => id === moveAction.id)
  const selectedColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
  Assert.isDefined(selectedMove)
  Assert.isDefined(selectedColonize)
  const winningAction = required(selectedView.actions.find(isActionSelected))
  const beforeClosure = {
    influence: selectedView.resources[ResourceType.INFLUENCE],
    fuel: selectedView.resources[ResourceType.FUEL],
  }
  return { race, selectedView, selectedMove, selectedColonize, winningAction, beforeClosure }
}

async function createClosureColonizeSetup({
  selectedView,
  colonizeAction,
  alice,
  gameId,
  stationary,
  target,
  bob,
  turnProcessor,
}: CreateClosureColonizeSetupInput): Promise<CreateClosureColonizeSetupResult> {
  const closureColonize = selectedView.actions.find(({ id }) => id === colonizeAction.id)
  Assert.isDefined(closureColonize)
  expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total)
  expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total)

  const closureGate = startTogether(3)
  const closureRace = await Promise.allSettled([
    (async (): Promise<void> => {
      await closureGate()
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: selectedView.turn,
        submittedActionTargets: {
          actionId: closureColonize.id,
          selectedTargets: { fleet: stationary.id, planet: target.id },
          selectedInputs: {},
        },
      })
    })(),
    (async (): Promise<void> => {
      await closureGate()
      await alice.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
    })(),
    (async (): Promise<void> => {
      await closureGate()
      await bob.client.gameplay.updateReadiness.mutate({ gameId, turn: selectedView.turn, isReady: true })
    })(),
  ])
  expect(closureRace[1]?.status).toBe("fulfilled")
  expect(closureRace[2]?.status).toBe("fulfilled")
  const closureSubmissionStatus = required(closureRace[0]).status

  await assertLockedView({ alice, gameId, closureColonize, closureSubmissionStatus, selectedView, stationary, target, turnProcessor })

  let completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  await expect
    .poll(async () => (await alice.client.gameplay.getPlayerView.query({ gameId })).turn, { timeout: 20_000, interval: 25 })
    .toBe(selectedView.turn + 1)
  completedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const claimedPlanet = getPlanets(completedView).find(({ id }) => id === target.id)
  Assert.isDefined(claimedPlanet)
  return { closureColonize, closureRace, closureSubmissionStatus, completedView, claimedPlanet }
}

type CreateClientsSetupInput = { server: ConcurrencyTestApiServer }

type CreateClientsSetupResult = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  turnProcessor: TurnProcessor
  homeA: Planet
  target: Planet
  views: PlayerView[]
  stagedFriendly: Fleet
  aliceSource: Fleet
  speed4ActionId: string
  speed2ActionId: string
  selectedViews: PlayerView[]
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

type CreateFinalReplaySetupInput = {
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  speed4ActionId: string
  speed2ActionId: string
  stagedFriendly: Fleet
  selectedViews: PlayerView[]
  target: Planet
  aliceSource: Fleet
  homeA: Planet
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
}

type CreateFinalReplaySetupResult = {
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  reversedReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  mergedFriendly: ResolutionFleet
  updatedVerifyMergedFriendly: AssertMergedFriendlyResult
}

type CreateAliceSetupInput = { server: ConcurrencyTestApiServer }

type CreateAliceSetupResult = {
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  gameId: number
  turnProcessor: TurnProcessor
  homeA: Planet
  target: Planet
  arrivedView: PlayerView
  stationary: Fleet
  moveAction: Action
  colonizeAction: Action
  raceGate: () => Promise<void>
}

type CreateRaceSetupInput = {
  raceGate: () => Promise<void>
  alice: AuthenticatedApiClient
  gameId: number
  arrivedView: PlayerView
  moveAction: Action
  stationary: Fleet
  homeA: Planet
  colonizeAction: Action
  target: Planet
}

type CreateRaceSetupResult = {
  race: [PromiseSettledResult<void>, PromiseSettledResult<void>]
  selectedView: PlayerView
  selectedMove: Action
  selectedColonize: Action
  winningAction: Action
  beforeClosure: { influence: { uncommitted: number; total: number }; fuel: { uncommitted: number; total: number } }
}

type CreateClosureColonizeSetupInput = {
  selectedView: PlayerView
  colonizeAction: Action
  alice: AuthenticatedApiClient
  gameId: number
  stationary: Fleet
  target: Planet
  bob: AuthenticatedApiClient
  turnProcessor: TurnProcessor
}

type CreateClosureColonizeSetupResult = {
  closureColonize: Action
  closureRace: [PromiseSettledResult<void>, PromiseSettledResult<void>, PromiseSettledResult<void>]
  closureSubmissionStatus: "rejected" | "fulfilled"
  completedView: PlayerView
  claimedPlanet: Planet
}
