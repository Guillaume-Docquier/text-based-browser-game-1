import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet, Action } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { logReceipt, required, findPublicFleet } from "../colonization/gameplay.colonization.ts"
import type { AssertScenarioState2Input } from "./gameplay.colonization.renamed-content.ts"

export async function assertLockedView(input: AssertLockedViewInput): Promise<void> {
  const lockedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const lockedColonize = required(lockedView.actions.find(({ id }) => id === input.closureColonize.id))
  const lockedObservation = {
    turn: lockedView.turn,
    turnStatus: lockedView.turnStatus,
    isReady: lockedView.player.isReady,
    closureSubmissionStatus: input.closureSubmissionStatus,
    selectedTargets: lockedColonize.selectedTargets,
    selectedInputs: lockedColonize.selectedInputs,
  }
  const inFlightTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].flatMap((turnStatus) => [
    {
      turn: input.selectedView.turn,
      turnStatus,
      isReady: true,
      closureSubmissionStatus: "fulfilled",
      selectedTargets: { fleet: input.stationary.id, planet: input.target.id },
      selectedInputs: {},
    },
    {
      turn: input.selectedView.turn,
      turnStatus,
      isReady: true,
      closureSubmissionStatus: "rejected",
      selectedTargets: null,
      selectedInputs: null,
    },
  ])
  const completedTurnObservations = [TurnStatus.AWAITING_PROCESSING, TurnStatus.PROCESSING].map((turnStatus) => ({
    turn: input.selectedView.turn + 1,
    turnStatus,
    isReady: false,
    closureSubmissionStatus: input.closureSubmissionStatus,
    selectedTargets: null,
    selectedInputs: null,
  }))
  expect([...inFlightTurnObservations, ...completedTurnObservations]).toContainEqual(lockedObservation)

  const processingOutcome = await input.turnProcessor.processNextDueTurn()
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

export function assertRemainingAtTarget(input: AssertRemainingAtTargetInput): void {
  const remainingAtTarget = findPublicFleet(input.completedView.fleets, {
    ownerPlayerId: input.completedView.player.id,
    originPlanetId: input.target.id,
    stationary: true,
  })
  const completedObservation = {
    closureSubmissionStatus: input.closureSubmissionStatus,
    ownerPlayerId: input.claimedPlanet.ownerPlayerId,
    remainingStrength: remainingAtTarget?.strength,
    influence: input.completedView.resources[ResourceType.INFLUENCE].total,
  }

  assertScenarioState2({ ...input, completedObservation })
  logReceipt("[C3-18 PostgreSQL reservation and closure receipt]", {
    gameId: input.gameId,
    seed: 1,
    source: { id: input.stationary.id, strength: 35, planet: input.target.id },
    concurrentReservations: { move16: input.race[0]?.status, stationaryColonize20: input.race[1]?.status },
    lockedResources: input.beforeClosure,
    closureSubmission: input.closureRace[0]?.status,
    readiness: input.closureRace.slice(1).map(({ status }) => status),
    persistedOwner: input.claimedPlanet.ownerPlayerId,
    persistedFleetStrength: remainingAtTarget?.strength,
    influence: input.completedView.resources[ResourceType.INFLUENCE].total,
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

export function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect([
    {
      closureSubmissionStatus: "fulfilled",
      ownerPlayerId: input.completedView.player.id,
      remainingStrength: 15,
      influence: input.selectedView.resources[ResourceType.INFLUENCE].total - 25,
    },
    {
      closureSubmissionStatus: "rejected",
      ownerPlayerId: null,
      remainingStrength: 35,
      influence: input.selectedView.resources[ResourceType.INFLUENCE].total,
    },
  ]).toContainEqual(input.completedObservation)
  expect(input.completedView.resources[ResourceType.COLONY].total).toBe(0)
  expect(input.completedView.actions.find(({ id }) => id === input.closureColonize.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(input.completedView.turn).toBe(input.selectedView.turn + 1)
}
