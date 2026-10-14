import { type Success, Assert } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { expect } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
  processTurnWithReplay as CapturedprocessTurnWithReplay,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  getFleetAt,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../colonization/gameplay.colonization.scenarios.ts"
import { required, submitAction } from "../colonization/gameplay.colonization.ts"

export async function createStagedAliceSetup(input: CreateStagedAliceSetupInput): Promise<CreateStagedAliceSetupResult> {
  const aliceStagingArrival = input.stagingResolutions.find(({ fleets }) => fleets[input.stagedAliceJourneyId]?.arrivedAtTick !== undefined)
  const carolStagingArrival = input.stagingResolutions.find(({ fleets }) => fleets[input.stagedCarolJourneyId]?.arrivedAtTick !== undefined)
  Assert.isDefined(aliceStagingArrival)
  Assert.isDefined(carolStagingArrival)
  expect(aliceStagingArrival.fleets[input.stagedAliceJourneyId]?.arrivedAtTick).toBe(3)
  expect(carolStagingArrival.fleets[input.stagedCarolJourneyId]?.arrivedAtTick).toBe(10)
  const stagedAlice = getFleetAt(required(input.views[0]), required(input.homeIdsByPlayer[0]), input.target.id, 35)
  const stagedCarol = getFleetAt(required(input.views[2]), required(input.homeIdsByPlayer[2]), input.target.id, 48)
  expect(
    required(input.views[0])
      .galaxy.systems.flatMap(({ planets }) => planets)
      .find(({ id }) => id === input.target.id)?.ownerPlayerId,
  ).toBeNull()

  const bobColonizeActionId = await submitAction({
    client: input.bob.client,
    gameId: input.gameId,
    view: required(input.views[1]),
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: {
      fleet: getFleetAt(required(input.views[1]), required(input.homeIdsByPlayer[1]), required(input.homes[1]).id, 70).id,
      planet: input.target.id,
    },
    selectedInputs: { strength: 70 },
  })
  const bobDeparture = await processTurnWithReplay({ ...input, turn: required(input.views[0]).turn })
  return { stagedAlice, stagedCarol, bobColonizeActionId, bobDeparture }
}

export type CreateStagedAliceSetupInput = {
  stagingResolutions: ResolvedTurnState[]
  stagedAliceJourneyId: FleetId
  stagedCarolJourneyId: FleetId
  views: PlayerView[]
  homeIdsByPlayer: PlayerId[]
  target: Planet
  bob: AuthenticatedApiClient
  gameId: GameId
  homes: Planet[]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
}

export type CreateStagedAliceSetupResult = {
  stagedAlice: Fleet
  stagedCarol: Fleet
  bobColonizeActionId: string
  bobDeparture: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
}

export async function createReadyViewsSetup(input: CreateReadyViewsSetupInput): Promise<CreateReadyViewsSetupResult> {
  const readyViews = input.views
  const currentAlice = getFleetAt(required(readyViews[0]), required(input.homeIdsByPlayer[0]), input.target.id, 35)
  const currentCarol = getFleetAt(required(readyViews[2]), required(input.homeIdsByPlayer[2]), input.target.id, 48)
  const bobJourney = required(readyViews[1]).fleets.find(({ id }) => id === input.movingBobId)
  Assert.isDefined(bobJourney)
  expect(bobJourney.movement).toBeDefined()
  expect(bobJourney.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
  const aliceColonizeActionId = await submitAction({
    client: input.alice.client,
    gameId: input.gameId,
    view: required(readyViews[0]),
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: currentAlice.id, planet: input.target.id },
    selectedInputs: {},
  })
  const carolAssaultActionId = await submitAction({
    client: input.carol.client,
    gameId: input.gameId,
    view: required(readyViews[2]),
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: { station: currentCarol.id, battlePlanet: input.target.id },
    selectedInputs: {},
  })

  const finalTurnInput = await captureWorkerInput({ ...input, turn: required(readyViews[0]).turn })
  const finalReplay = replayWorkerInputWithState(finalTurnInput)
  const publicReplay = finalReplay.resolved
  Assert.isSuccess(publicReplay)
  expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
  expect(publicReplay.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
  expect(
    publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
  expect(
    publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === carolAssaultActionId)?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
  expect(
    publicReplay.value.resolvedContinuations
      .find(({ originatingSubmission }) => originatingSubmission.id === input.bobColonizeActionId)
      ?.actionOutcomes.at(-1)?.type,
  ).toBe("RESOLVED")
  return { readyViews, bobJourney, finalTurnInput, finalReplay, publicReplay }
}

export type CreateReadyViewsSetupInput = {
  views: PlayerView[]
  homeIdsByPlayer: PlayerId[]
  target: Planet
  movingBobId: FleetId
  alice: AuthenticatedApiClient
  gameId: GameId
  carol: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  bobColonizeActionId: string
}

export type CreateReadyViewsSetupResult = {
  readyViews: PlayerView[]
  bobJourney: Fleet
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  publicReplay: Success<ResolvedTurnState>
}
