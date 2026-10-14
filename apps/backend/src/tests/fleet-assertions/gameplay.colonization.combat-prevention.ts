import { type NonNegativeNumber, typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet } from "#api/types.ts"
import { fleetsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
  processTurnWithReplay as CapturedprocessTurnWithReplay,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { getPlanets, getFleetAt } from "../colonization/gameplay.colonization.scenarios.ts"
import {
  logReceipt,
  required,
  playerIdFor,
  hasResolvedResult,
  hasPreventedReason,
  describeOutcomeRecord,
  readViews,
} from "../colonization/gameplay.colonization.ts"

export async function assertEmptyTurnReplay({
  assertEmptyTurnReplayPhase1Value1,
  emptyTurnReplay,
  emptyTurnInput,
  turnProcessor,
  player,
  gameId,
  arrivedView,
  target,
  colonizeActionId,
  server,
  home,
  sourceFleet,
  selectedView,
  journey,
  assertEmptyTurnReplayPhase1Value2,
}: AssertEmptyTurnReplayInput): Promise<void> {
  expect(assertEmptyTurnReplayPhase1Value1.removedFleetIds).toStrictEqual([])
  expect(assertEmptyTurnReplayPhase1Value1.planetOwnershipChanges).toStrictEqual([])
  expect(emptyTurnReplay.nextRngState).toStrictEqual(emptyTurnInput.rngState)
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const emptyTurnView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(emptyTurnView.turn).toBe(arrivedView.turn + 1)
  expect(getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
  expect(emptyTurnView.fleets).toHaveLength(0)
  expect(emptyTurnView.resources).toStrictEqual(arrivedView.resources)
  expect(emptyTurnView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(
    await server.database
      .select()
      .from(fleetsTable)
      .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
  ).toHaveLength(0)

  logReceipt("[C3-03 public exact20 deletion receipt]", {
    gameId,
    seed: 1234,
    player: playerIdFor(player),
    home: { id: home.id, name: home.name, coordinates: home.coordinates },
    target: { id: target.id, name: target.name, coordinates: target.coordinates },
    builtStrength: sourceFleet.strength,
    departure: { turn: selectedView.turn, selected: 20, journeyId: journey.id },
    arrival: {
      turn: arrivedView.turn,
      owner: getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId,
      removedFleetIds: assertEmptyTurnReplayPhase1Value2.removedFleetIds,
      changedPlanets: assertEmptyTurnReplayPhase1Value2.planetOwnershipChanges,
    },
    resources: {
      influence: arrivedView.resources[ResourceType.INFLUENCE].total,
      metal: arrivedView.resources[ResourceType.METAL].total,
      colony: arrivedView.resources[ResourceType.COLONY].total,
    },
    nextEmptyTurn: {
      turn: emptyTurnView.turn,
      owner: getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId,
      fleets: emptyTurnView.fleets.length,
      unchangedResources: JSON.stringify(emptyTurnView.resources) === JSON.stringify(arrivedView.resources),
      colonizeActionAvailable: emptyTurnView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress === false,
    },
  })
}

export type AssertEmptyTurnReplayInput = {
  assertEmptyTurnReplayPhase1Value1: ResolvedTurnState
  emptyTurnReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  emptyTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: number
  arrivedView: PlayerView
  target: Planet
  colonizeActionId: string
  server: ConcurrencyTestApiServer
  home: Planet
  sourceFleet: Fleet
  selectedView: PlayerView
  journey: Fleet
  assertEmptyTurnReplayPhase1Value2: ResolvedTurnState
}

export async function assertFinalOutcomes({
  finalOutcomes,
  turnProcessor,
  views,
  clients,
  gameId,
  target,
  aliceAttemptId,
  bobAttemptId,
  server,
}: AssertFinalOutcomesInput): Promise<AssertFinalOutcomesResult> {
  expect(finalOutcomes.filter((outcome) => hasResolvedResult(outcome, "exchanged 20 Strength with 20 enemy Strength"))).toHaveLength(1)
  expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before colonization"))).toHaveLength(2)
  expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before its Assault"))).toHaveLength(1)
  expect(finalOutcomes).not.toContainEqual(
    expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(" colonized Planet ") }),
  )
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  views = await readViews(clients, gameId)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(views.map(({ fleets }) => fleets)).toStrictEqual([[], []])
  expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
    { total: 493, uncommitted: 493 },
    { total: 493, uncommitted: 493 },
  ])
  expect(views.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([99, 99])
  expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
  for (const [view, actionId] of [
    [required(views[0]), aliceAttemptId],
    [required(views[1]), bobAttemptId],
  ] as const) {
    expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
  expect(
    await server.database
      .select()
      .from(fleetsTable)
      .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
  ).toHaveLength(0)

  return { views }
}

export type AssertFinalOutcomesInput = {
  finalOutcomes: EffectOutcome[]
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  target: Planet
  aliceAttemptId: string
  bobAttemptId: string
  server: ConcurrencyTestApiServer
}

export type AssertFinalOutcomesResult = { views: PlayerView[] }

export function assertPersistedNextRngState({
  savedNextTurn,
  replay,
  gameId,
  homeA,
  homeB,
  target,
  aliceDistance,
  bobDistance,
  aliceFleet,
  bobFleet,
  assertPersistedNextRngStatePhase3Value1,
  workerInput,
  aliceContinuation,
  bobContinuation,
  finalOutcomes,
  views,
}: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

  logReceipt("[C3-05/16 public exact20 mutual Assault receipt]", {
    gameId,
    seed: 1,
    homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: target.id, name: target.name, coordinates: target.coordinates },
    routes: { aliceDistance, bobDistance, speed: { alice: 1, bob: 5 } },
    loadedForces: { alice: { fleetId: aliceFleet.id, strength: 20 }, bob: { fleetId: bobFleet.id, strength: 20 } },
    removedFleetIds: assertPersistedNextRngStatePhase3Value1.removedFleetIds,
    arrivalTurn: workerInput.turn,
    continuations: [aliceContinuation, bobContinuation].map(({ originatingSubmission, departureTurn }) => ({
      actionId: originatingSubmission.id,
      departureTurn,
    })),
    outcomeTrace: finalOutcomes.map(describeOutcomeRecord),

    persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
    persistedFleets: views.flatMap(({ fleets }) => fleets),
    persistedResources: views.map(({ resources }) => ({
      influence: resources[ResourceType.INFLUENCE].total,
      fuel: resources[ResourceType.FUEL].total,
      colony: resources[ResourceType.COLONY].total,
    })),
    loadedRngState: workerInput.rngState,
    replayNextRngState: replay.nextRngState,
    persistedNextRngState,
  })
}

export type AssertPersistedNextRngStateInput = {
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
  homeA: Planet
  homeB: Planet
  target: Planet
  aliceDistance: number
  bobDistance: number
  aliceFleet: Fleet
  bobFleet: Fleet
  assertPersistedNextRngStatePhase3Value1: ResolvedTurnState
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  aliceContinuation: ResolvedTurnState["resolvedContinuations"][number]
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  finalOutcomes: EffectOutcome[]
  views: PlayerView[]
}

export type AssertPersistedNextRngState2Input = {
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
  homeA: Planet
  homeB: Planet
  target: Planet
  alice: AuthenticatedApiClient
  transitDistances: number[]
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  assertPersistedNextRngStatePhase4Value1: ResolvedTurnState
  bobJourney: Fleet
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  views: PlayerView[]
}

export function assertPersistedNextRngState2({
  savedNextTurn,
  replay,
  gameId,
  homeA,
  homeB,
  target,
  alice,
  transitDistances,
  workerInput,
  assertPersistedNextRngStatePhase4Value1,
  bobJourney,
  bobContinuation,
  views,
}: AssertPersistedNextRngState2Input): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

  logReceipt("[C3-06 public claimed-in-transit Colonize receipt]", {
    gameId,
    seed: 1,
    homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: target.id, name: target.name, coordinates: target.coordinates },
    routes: { aliceDistance: 1.2645395167985714, bobDistance: 18.852953053708077, bobSpeed: 5 },
    ownerWhileTransit: playerIdFor(alice),
    transitDistances,
    finalArrivalTurn: workerInput.turn,
    finalFleet: assertPersistedNextRngStatePhase4Value1.fleets[bobJourney.id],
    continuationOutcomes: bobContinuation.actionOutcomes,
    persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
    persistedFleets: views.flatMap(({ fleets }) => fleets),
    persistedResources: views.map(({ resources }) => ({
      influence: resources[ResourceType.INFLUENCE].total,
      fuel: resources[ResourceType.FUEL].total,
      colony: resources[ResourceType.COLONY].total,
    })),
    loadedRngState: workerInput.rngState,
    replayNextRngState: replay.nextRngState,
    persistedNextRngState,
  })
}

export function assertReplayMoveFleet({
  replayMoveFleet,
  views,
  target,
  bobJourney,
  aliceMoveId,
  ordinaryArrival,
  gameId,
  alice,
  homeA,
  bob,
  homeB,
  bobBuildId,
  bobMoveId,
  aliceBuildId,
  bobReplayArrivalTick,
  persistedEnemy,
}: AssertReplayMoveFleetInput): void {
  expect(replayMoveFleet.arrivedAtTick).toBe(3)
  const persistedMoveFleet = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
  expect(persistedMoveFleet.id).toBe(replayMoveFleet.id)

  expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).id).toBe(bobJourney.id)
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(required(views[0]).actions.find(({ id }) => id === aliceMoveId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  const aliceMoveOutcomes = ordinaryArrival.resolved.resolvedActions.find(
    ({ submittedAction }) => submittedAction.id === aliceMoveId,
  )?.actionOutcomes
  expect(aliceMoveOutcomes?.every(({ type }) => type === "RESOLVED")).toBe(true)

  logReceipt("[C3-11 public ordinary Move35/enemy10 control receipt]", {
    gameId,
    mapSeed: 1,
    homes: [
      { player: playerIdFor(alice), id: homeA.id, name: homeA.name, coordinates: homeA.coordinates },
      { player: playerIdFor(bob), id: homeB.id, name: homeB.name, coordinates: homeB.coordinates },
    ],
    target: { id: target.id, name: target.name, coordinates: target.coordinates },
    routes: {
      bobDistance: 18.852953053708077,
      aliceDistance: 1.2645395167985714,
      bobSpeed: 10,
      aliceSpeed: 10,
    },
    publicActions: {
      bobBuild10: bobBuildId,
      bobOrdinaryMove10: bobMoveId,
      aliceBuild35: aliceBuildId,
      aliceOrdinaryMove35: aliceMoveId,
    },
    copiedInputReplay: {
      bobArrivalTick: bobReplayArrivalTick,
      aliceArrivalTick: replayMoveFleet.arrivedAtTick,
      aliceActionOutcomes: ordinaryArrival.resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceMoveId)
        ?.actionOutcomes,
    },
    persistedApiReadThrough: {
      planetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
      fleets: [persistedMoveFleet, persistedEnemy].map(({ id, ownerPlayerId, originPlanetId, strength }) => ({
        id,
        ownerPlayerId,
        originPlanetId,
        strength,
      })),
    },
  })
}

export type AssertReplayMoveFleetInput = {
  replayMoveFleet: ResolutionFleet
  views: PlayerView[]
  target: Planet
  bobJourney: Fleet
  aliceMoveId: string
  ordinaryArrival: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  gameId: number
  alice: AuthenticatedApiClient
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  bobBuildId: string
  bobMoveId: string
  aliceBuildId: string
  bobReplayArrivalTick: undefined | NonNegativeNumber
  persistedEnemy: Fleet
}
