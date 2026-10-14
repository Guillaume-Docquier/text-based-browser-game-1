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

export async function createStagedAliceSetup({
  stagingResolutions,
  stagedAliceJourneyId,
  stagedCarolJourneyId,
  views,
  homeIdsByPlayer,
  target,
  bob,
  gameId,
  homes,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
}: CreateStagedAliceSetupInput): Promise<CreateStagedAliceSetupResult> {
  const aliceStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedAliceJourneyId]?.arrivedAtTick !== undefined)
  const carolStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedCarolJourneyId]?.arrivedAtTick !== undefined)
  Assert.isDefined(aliceStagingArrival)
  Assert.isDefined(carolStagingArrival)
  expect(aliceStagingArrival.fleets[stagedAliceJourneyId]?.arrivedAtTick).toBe(3)
  expect(carolStagingArrival.fleets[stagedCarolJourneyId]?.arrivedAtTick).toBe(10)
  const stagedAlice = getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), target.id, 35)
  const stagedCarol = getFleetAt(required(views[2]), required(homeIdsByPlayer[2]), target.id, 48)
  expect(
    required(views[0])
      .galaxy.systems.flatMap(({ planets }) => planets)
      .find(({ id }) => id === target.id)?.ownerPlayerId,
  ).toBeNull()

  const bobColonizeActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: {
      fleet: getFleetAt(required(views[1]), required(homeIdsByPlayer[1]), required(homes[1]).id, 70).id,
      planet: target.id,
    },
    selectedInputs: { strength: 70 },
  })
  const bobDeparture = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
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

export async function createReadyViewsSetup({
  views,
  homeIdsByPlayer,
  target,
  movingBobId,
  alice,
  gameId,
  carol,
  server,
  clock,
  turnsRepository,
  bobColonizeActionId,
}: CreateReadyViewsSetupInput): Promise<CreateReadyViewsSetupResult> {
  const readyViews = views
  const currentAlice = getFleetAt(required(readyViews[0]), required(homeIdsByPlayer[0]), target.id, 35)
  const currentCarol = getFleetAt(required(readyViews[2]), required(homeIdsByPlayer[2]), target.id, 48)
  const bobJourney = required(readyViews[1]).fleets.find(({ id }) => id === movingBobId)
  Assert.isDefined(bobJourney)
  expect(bobJourney.movement).toBeDefined()
  expect(bobJourney.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
  const aliceColonizeActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(readyViews[0]),
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: currentAlice.id, planet: target.id },
    selectedInputs: {},
  })
  const carolAssaultActionId = await submitAction({
    client: carol.client,
    gameId,
    view: required(readyViews[2]),
    actionDefinitionId: StationaryAssaultTest.id,
    selectedTargets: { station: currentCarol.id, battlePlanet: target.id },
    selectedInputs: {},
  })

  const finalTurnInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: required(readyViews[0]).turn,
  })
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
      .find(({ originatingSubmission }) => originatingSubmission.id === bobColonizeActionId)
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
