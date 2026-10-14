import { Assert, indexBy, mulberry32Prng, Rng } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { expect } from "vitest"
import type { PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { TurnToProcessModel } from "#turn-processing/turns.repository.ts"
import {
  MANUAL_CLOCK_ADVANCE,
  BuildFleet10ForStaging,
  BuildFleet35,
  BuildFleet50,
  type PublicClient,
  required,
  type PublicPlanet,
  type PublicFleet,
  type PublicTurnProcessor,
  type PublicTwoPlayerFixture,
  submitAction,
  readViews,
  type PublicStagedMergeScenario,
} from "./gameplay.colonization.ts"

export async function stagePublicMergeScenario(
  server: ConcurrencyTestApiServer,
  fixture: PublicTwoPlayerFixture,
): Promise<PublicStagedMergeScenario> {
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
  let views = fixture.views
  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
  views = await readViews(clients, gameId)
  const aliceStagingFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)
  const bobSourceFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: aliceStagingFleet.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet50.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const bobStageActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: bobSourceFleet.id, planet: homeA.id },
    selectedInputs: { strength: 35 },
  })
  let stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  const stagedArrival = Object.values(stage.resolved.fleets).find(
    ({ ownerPlayerId, originPlanetId, strength }) =>
      ownerPlayerId === required(views[0]).player.id && originPlanetId === target.id && strength === 10,
  )
  Assert.isDefined(stagedArrival)
  expect(stagedArrival.arrivedAtTick).toBe(6)
  expect(stage.resolved.removedFleetIds).toContain(aliceStagingFleet.id)
  const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobStageActionId)
  Assert.isDefined(bobJourney)
  const bobJourneyId = bobJourney.id
  expect(bobJourney.distanceToEnd).toBeCloseTo(15.111265402761585, 12)

  for (const expectedDistance of [10.111265402761585, 5.111265402761585, 0.111265402761585]) {
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const currentJourney = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
    Assert.isDefined(currentJourney)
    expect(currentJourney.distanceToEnd).toBeCloseTo(expectedDistance, 12)
  }
  stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
  views = stage.views
  expect(stage.resolved.fleets[bobJourneyId]?.arrivedAtTick).toBe(1)
  const bobAtSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeA.id, 35)
  expect(bobAtSource.id).toBe(bobJourneyId)
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
  const stagedFriendly = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
  expect(stagedFriendly.id).toBe(stagedArrival.id)
  return { fixture, views, stagedFriendly, bobAtSource, aliceSource, bobStageActionId }
}

export function getPlanets(view: PlayerView): PublicPlanet[] {
  return view.galaxy.systems.flatMap(({ planets }) => planets)
}

export function getHome(view: PlayerView): PublicPlanet {
  const home = getPlanets(view).find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
  Assert.isDefined(home)
  return home
}

export function getFleetAt(view: PlayerView, ownerPlayerId: PlayerId, planetId: PublicPlanet["id"], strength: number): PublicFleet {
  const fleet = view.fleets.find(
    ({ ownerPlayerId: candidateOwner, originPlanetId, movement, strength: candidateStrength }) =>
      candidateOwner === ownerPlayerId && originPlanetId === planetId && movement === undefined && candidateStrength === strength,
  )
  if (fleet === undefined) {
    throw new Error(
      `Expected stationary Fleet strength ${strength} for owner ${ownerPlayerId} at ${planetId}; observed ${JSON.stringify(view.fleets)}`,
    )
  }
  return fleet
}

export async function processTurn({
  clock,
  turnsRepository,
  turnProcessor,
  client,
  gameId,
  turn,
}: {
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  client: AuthenticatedApiClient["client"]
  gameId: number
  turn: number
}): Promise<PlayerView> {
  clock.increment({ time: MANUAL_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const nextView = await client.gameplay.getPlayerView.query({ gameId })
  expect(nextView.turn).toBe(turn + 1)
  expect(nextView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  return nextView
}

export async function processTurnWithReplay({
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
  turn,
}: {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  turnProcessor: PublicTurnProcessor["turnProcessor"]
  clients: readonly PublicClient[]
  gameId: number
  turn: number
}): Promise<{ views: PlayerView[]; resolved: ResolvedTurnState }> {
  const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn })
  const replay = replayWorkerInput(workerInput)
  Assert.isSuccess(replay)
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const views = await readViews(clients, gameId)
  expect(views[0]?.turn).toBe(turn + 1)
  expect(views[0]?.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  return { views, resolved: replay.value }
}

export async function captureWorkerInput({
  server,
  clock,
  turnsRepository,
  gameId,
  turn,
}: {
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: PublicTurnProcessor["turnsRepository"]
  gameId: number
  turn: number
}): Promise<TurnToProcessModel> {
  clock.increment({ time: MANUAL_CLOCK_ADVANCE })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  let observed: TurnToProcessModel | undefined
  const rollbackMessage = `Intentional public colonization observation rollback for game ${gameId} turn ${turn}`
  await expect(
    server.database.transaction(async (tx) => {
      const nextTurn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
      Assert.isDefined(nextTurn)
      expect(nextTurn.gameId).toBe(gameId)
      expect(nextTurn.turn).toBe(turn)
      observed = structuredClone(await turnsRepository.startTurnProcessing({ turn: nextTurn, processingStartedAt: clock.now() }, tx))
      throw new TransactionRollbackError(rollbackMessage)
    }),
  ).rejects.toMatchObject({ name: "TransactionRollbackError", message: rollbackMessage })
  Assert.isDefined(observed)
  return observed
}

export function replayWorkerInput(input: TurnToProcessModel, reverseEnumeration = false): ReturnType<typeof resolveTurn> {
  return replayWorkerInputWithState(input, reverseEnumeration).resolved
}

export function compareOrdinalPair(first: string, second: string, nextFirst: string, nextSecond: string): number {
  const primaryComparison = compareOrdinalStrings(first, second)
  return primaryComparison === 0 ? compareOrdinalStrings(nextFirst, nextSecond) : primaryComparison
}

export function canonicalizeResolvedTurn(resolved: ResolvedTurnState): ResolvedTurnState {
  return {
    ...resolved,
    resolvedActions: resolved.resolvedActions.toSorted((first, second) =>
      compareOrdinalPair(
        first.submittedAction.playerId,
        second.submittedAction.playerId,
        first.submittedAction.id,
        second.submittedAction.id,
      ),
    ),
    resolvedContinuations: resolved.resolvedContinuations.toSorted((first, second) =>
      compareOrdinalPair(
        first.originatingSubmission.playerId,
        second.originatingSubmission.playerId,
        first.originatingSubmission.id,
        second.originatingSubmission.id,
      ),
    ),
  }
}

export function replayWorkerInputWithState(
  input: TurnToProcessModel,
  reverseEnumeration = false,
): {
  resolved: ReturnType<typeof resolveTurn>
  nextRngState: ReturnType<ReturnType<typeof Rng.fromState>["getState"]>
} {
  const rng = Rng.fromState(structuredClone(input.rngState), mulberry32Prng)
  const ordered = <T>(values: T[]): T[] => (reverseEnumeration ? values.toReversed() : values)
  const resolved = resolveTurn(
    {
      gameId: input.gameId,
      turn: input.turn,
      submittedActions: ordered(structuredClone(input.submittedActions)),
      players: indexBy("id", ordered(structuredClone(Object.values(input.players)))),
      planets: indexBy("id", ordered(structuredClone(Object.values(input.planets)))),
      fleets: indexBy("id", ordered(structuredClone(Object.values(input.fleets)))),
      winnerPlayerId: undefined,
    },
    input.ruleset,
    rng,
  )
  return { resolved, nextRngState: rng.getState() }
}
