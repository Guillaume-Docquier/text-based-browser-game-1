import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet, Action } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { logReceipt, required, findPublicFleet } from "../colonization/gameplay.colonization.ts"
import type { AssertScenarioState2Input } from "./gameplay.colonization.renamed-content.ts"

export async function assertLockedView({
  alice,
  gameId,
  closureColonize,
  closureSubmissionStatus,
  selectedView,
  stationary,
  target,
  turnProcessor,
}: AssertLockedViewInput): Promise<void> {
  const lockedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const lockedColonize = required(lockedView.actions.find(({ id }) => id === closureColonize.id))
  const lockedObservation = {
    turn: lockedView.turn,
    turnStatus: lockedView.turnStatus,
    isReady: lockedView.player.isReady,
    closureSubmissionStatus,
    selectedTargets: lockedColonize.selectedTargets,
    selectedInputs: lockedColonize.selectedInputs,
  }
  const inFlightTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].flatMap((turnStatus) => [
    {
      turn: selectedView.turn,
      turnStatus,
      isReady: true,
      closureSubmissionStatus: "fulfilled",
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    },
    {
      turn: selectedView.turn,
      turnStatus,
      isReady: true,
      closureSubmissionStatus: "rejected",
      selectedTargets: null,
      selectedInputs: null,
    },
  ])
  const completedTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].map((turnStatus) => ({
    turn: selectedView.turn + 1,
    turnStatus,
    isReady: false,
    closureSubmissionStatus,
    selectedTargets: null,
    selectedInputs: null,
  }))
  expect([...inFlightTurnObservations, ...completedTurnObservations]).toContainEqual(lockedObservation)

  const processingOutcome = await turnProcessor.processNextDueTurn()
  expect(["processed", "idle"]).toContain(processingOutcome)
}

export type AssertLockedViewInput = {
  alice: AuthenticatedApiClient
  gameId: number
  closureColonize: Action
  closureSubmissionStatus: "rejected" | "fulfilled"
  selectedView: PlayerView
  stationary: Fleet
  target: Planet
  turnProcessor: TurnProcessor
}

export function assertRemainingAtTarget({
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
}: AssertRemainingAtTargetInput): void {
  const remainingAtTarget = findPublicFleet(completedView.fleets, {
    ownerPlayerId: completedView.player.id,
    originPlanetId: target.id,
    stationary: true,
  })
  const completedObservation = {
    closureSubmissionStatus,
    ownerPlayerId: claimedPlanet.ownerPlayerId,
    remainingStrength: remainingAtTarget?.strength,
    influence: completedView.resources[ResourceType.INFLUENCE].total,
  }

  assertScenarioState2({ completedView, selectedView, completedObservation, closureColonize })
  logReceipt("[C3-18 PostgreSQL reservation and closure receipt]", {
    gameId,
    seed: 1,
    source: { id: stationary.id, strength: 35, planet: target.id },
    concurrentReservations: { move16: race[0]?.status, stationaryColonize20: race[1]?.status },
    lockedResources: beforeClosure,
    closureSubmission: closureRace[0]?.status,
    readiness: closureRace.slice(1).map(({ status }) => status),
    persistedOwner: claimedPlanet.ownerPlayerId,
    persistedFleetStrength: remainingAtTarget?.strength,
    influence: completedView.resources[ResourceType.INFLUENCE].total,
  })
}

export type AssertRemainingAtTargetInput = {
  completedView: PlayerView
  target: Planet
  closureSubmissionStatus: "rejected" | "fulfilled"
  claimedPlanet: Planet
  selectedView: PlayerView
  closureColonize: Action
  gameId: number
  stationary: Fleet
  race: [PromiseSettledResult<void>, PromiseSettledResult<void>]
  beforeClosure: { influence: { uncommitted: number; total: number }; fuel: { uncommitted: number; total: number } }
  closureRace: [PromiseSettledResult<void>, PromiseSettledResult<void>, PromiseSettledResult<void>]
}

export function assertScenarioState2({
  completedView,
  selectedView,
  completedObservation,
  closureColonize,
}: AssertScenarioState2Input): void {
  expect([
    {
      closureSubmissionStatus: "fulfilled",
      ownerPlayerId: completedView.player.id,
      remainingStrength: 15,
      influence: selectedView.resources[ResourceType.INFLUENCE].total - 25,
    },
    {
      closureSubmissionStatus: "rejected",
      ownerPlayerId: null,
      remainingStrength: 35,
      influence: selectedView.resources[ResourceType.INFLUENCE].total,
    },
  ]).toContainEqual(completedObservation)
  expect(completedView.resources[ResourceType.COLONY].total).toBe(0)
  expect(completedView.actions.find(({ id }) => id === closureColonize.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(completedView.turn).toBe(selectedView.turn + 1)
}
