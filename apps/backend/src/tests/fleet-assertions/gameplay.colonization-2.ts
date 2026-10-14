import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Planet, PlayerView } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { getPlanets } from "../colonization/gameplay.colonization.scenarios.ts"
import { required, playerIdFor } from "../colonization/gameplay.colonization.ts"

export async function assertJourney({
  journey,
  routeDistance,
  moveActionId,
  assertJourneyPhase6Value1,
  target,
  player,
  replay,
  workerInput,
  turnProcessor,
  view,
  gameId,
  selectedView,
  home,
  colonizeActionId,
}: AssertJourneyInput): Promise<AssertJourneyResult> {
  expect(journey.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
  expect(journey.movement).toMatchObject({ speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] })
  expect(assertJourneyPhase6Value1.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(player))
  expect(assertJourneyPhase6Value1.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
  expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  view = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(view.turn).toBe(selectedView.turn + 1)
  expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
  expect(view.fleets).toHaveLength(1)
  expect(view.fleets[0]).toMatchObject({
    id: journey.id,
    strength: 15,
    originPlanetId: target.id,
    destinationPlanetId: home.id,
    movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
  })
  expect(required(view.fleets[0]).distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 72, uncommitted: 72 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })

  return { view }
}

export type AssertJourneyInput = {
  journey: ResolutionFleet
  routeDistance: number
  moveActionId: string
  assertJourneyPhase6Value1: ResolvedTurnState
  target: Planet
  player: AuthenticatedApiClient
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  view: PlayerView
  gameId: GameId
  selectedView: PlayerView
  home: Planet
  colonizeActionId: string
}

export type AssertJourneyResult = { view: PlayerView }
