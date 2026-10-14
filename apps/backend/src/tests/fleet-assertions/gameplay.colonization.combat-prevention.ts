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

export async function assertEmptyTurnReplay(input: AssertEmptyTurnReplayInput): Promise<void> {
  expect(input.assertEmptyTurnReplayPhase1Value1.removedFleetIds).toStrictEqual([])
  expect(input.assertEmptyTurnReplayPhase1Value1.planetOwnershipChanges).toStrictEqual([])
  expect(input.emptyTurnReplay.nextRngState).toStrictEqual(input.emptyTurnInput.rngState)
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const emptyTurnView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(emptyTurnView.turn).toBe(input.arrivedView.turn + 1)
  expect(getPlanets(emptyTurnView).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBe(playerIdFor(input.player))
  expect(emptyTurnView.fleets).toHaveLength(0)
  expect(emptyTurnView.resources).toStrictEqual(input.arrivedView.resources)
  expect(emptyTurnView.actions.find(({ id }) => id === input.colonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(
    await input.server.database
      .select()
      .from(fleetsTable)
      .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, input.gameId))),
  ).toHaveLength(0)

  logReceipt("[C3-03 public exact20 deletion receipt]", {
    gameId: input.gameId,
    seed: 1234,
    player: playerIdFor(input.player),
    home: { id: input.home.id, name: input.home.name, coordinates: input.home.coordinates },
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    builtStrength: input.sourceFleet.strength,
    departure: { turn: input.selectedView.turn, selected: 20, journeyId: input.journey.id },
    arrival: {
      turn: input.arrivedView.turn,
      owner: getPlanets(input.arrivedView).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      removedFleetIds: input.assertEmptyTurnReplayPhase1Value2.removedFleetIds,
      changedPlanets: input.assertEmptyTurnReplayPhase1Value2.planetOwnershipChanges,
    },
    resources: {
      influence: input.arrivedView.resources[ResourceType.INFLUENCE].total,
      metal: input.arrivedView.resources[ResourceType.METAL].total,
      colony: input.arrivedView.resources[ResourceType.COLONY].total,
    },
    nextEmptyTurn: {
      turn: emptyTurnView.turn,
      owner: getPlanets(emptyTurnView).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      fleets: emptyTurnView.fleets.length,
      unchangedResources: JSON.stringify(emptyTurnView.resources) === JSON.stringify(input.arrivedView.resources),
      colonizeActionAvailable: emptyTurnView.actions.find(({ id }) => id === input.colonizeActionId)?.isInProgress === false,
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

export function assertPersistedNextRngState(input: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.replay.nextRngState)

  logReceipt("[C3-05/16 public exact20 mutual Assault receipt]", {
    gameId: input.gameId,
    seed: 1,
    homes: [input.homeA, input.homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    routes: { aliceDistance: input.aliceDistance, bobDistance: input.bobDistance, speed: { alice: 1, bob: 5 } },
    loadedForces: { alice: { fleetId: input.aliceFleet.id, strength: 20 }, bob: { fleetId: input.bobFleet.id, strength: 20 } },
    removedFleetIds: input.assertPersistedNextRngStatePhase3Value1.removedFleetIds,
    arrivalTurn: input.workerInput.turn,
    continuations: [input.aliceContinuation, input.bobContinuation].map(({ originatingSubmission, departureTurn }) => ({
      actionId: originatingSubmission.id,
      departureTurn,
    })),
    outcomeTrace: input.finalOutcomes.map(describeOutcomeRecord),

    persistedOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    persistedFleets: input.views.flatMap(({ fleets }) => fleets),
    persistedResources: input.views.map(({ resources }) => ({
      influence: resources[ResourceType.INFLUENCE].total,
      fuel: resources[ResourceType.FUEL].total,
      colony: resources[ResourceType.COLONY].total,
    })),
    loadedRngState: input.workerInput.rngState,
    replayNextRngState: input.replay.nextRngState,
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

export function assertPersistedNextRngState2(input: AssertPersistedNextRngState2Input): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.replay.nextRngState)

  logReceipt("[C3-06 public claimed-in-transit Colonize receipt]", {
    gameId: input.gameId,
    seed: 1,
    homes: [input.homeA, input.homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    routes: { aliceDistance: 1.2645395167985714, bobDistance: 18.852953053708077, bobSpeed: 5 },
    ownerWhileTransit: playerIdFor(input.alice),
    transitDistances: input.transitDistances,
    finalArrivalTurn: input.workerInput.turn,
    finalFleet: input.assertPersistedNextRngStatePhase4Value1.fleets[input.bobJourney.id],
    continuationOutcomes: input.bobContinuation.actionOutcomes,
    persistedOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    persistedFleets: input.views.flatMap(({ fleets }) => fleets),
    persistedResources: input.views.map(({ resources }) => ({
      influence: resources[ResourceType.INFLUENCE].total,
      fuel: resources[ResourceType.FUEL].total,
      colony: resources[ResourceType.COLONY].total,
    })),
    loadedRngState: input.workerInput.rngState,
    replayNextRngState: input.replay.nextRngState,
    persistedNextRngState,
  })
}

export function assertReplayMoveFleet(input: AssertReplayMoveFleetInput): void {
  expect(input.replayMoveFleet.arrivedAtTick).toBe(3)
  const persistedMoveFleet = getFleetAt(required(input.views[0]), required(input.views[0]).player.id, input.target.id, 35)
  expect(persistedMoveFleet.id).toBe(input.replayMoveFleet.id)

  expect(getFleetAt(required(input.views[1]), required(input.views[1]).player.id, input.target.id, 10).id).toBe(input.bobJourney.id)
  expect(getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  expect(required(input.views[0]).actions.find(({ id }) => id === input.aliceMoveId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  const aliceMoveOutcomes = input.ordinaryArrival.resolved.resolvedActions.find(
    ({ submittedAction }) => submittedAction.id === input.aliceMoveId,
  )?.actionOutcomes
  expect(aliceMoveOutcomes?.every(({ type }) => type === "RESOLVED")).toBe(true)

  logReceipt("[C3-11 public ordinary Move35/enemy10 control receipt]", {
    gameId: input.gameId,
    mapSeed: 1,
    homes: [
      { player: playerIdFor(input.alice), id: input.homeA.id, name: input.homeA.name, coordinates: input.homeA.coordinates },
      { player: playerIdFor(input.bob), id: input.homeB.id, name: input.homeB.name, coordinates: input.homeB.coordinates },
    ],
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates },
    routes: {
      bobDistance: 18.852953053708077,
      aliceDistance: 1.2645395167985714,
      bobSpeed: 10,
      aliceSpeed: 10,
    },
    publicActions: {
      bobBuild10: input.bobBuildId,
      bobOrdinaryMove10: input.bobMoveId,
      aliceBuild35: input.aliceBuildId,
      aliceOrdinaryMove35: input.aliceMoveId,
    },
    copiedInputReplay: {
      bobArrivalTick: input.bobReplayArrivalTick,
      aliceArrivalTick: input.replayMoveFleet.arrivedAtTick,
      aliceActionOutcomes: input.ordinaryArrival.resolved.resolvedActions.find(
        ({ submittedAction }) => submittedAction.id === input.aliceMoveId,
      )?.actionOutcomes,
    },
    persistedApiReadThrough: {
      planetOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
      fleets: [persistedMoveFleet, input.persistedEnemy].map(({ id, ownerPlayerId, originPlanetId, strength }) => ({
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
