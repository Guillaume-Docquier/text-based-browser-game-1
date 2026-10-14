import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { expect } from "vitest"
import type { Fleet, Action, Planet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { processPublicTurn, observeTurnAndRollback, getActionToSubmintegrationTest } from "../fleet-worker/TurnProcessor.scenarios.ts"

export async function assertActionSelections({
  alice,
  gameId,
  aliceFinalView,
  inboundAction,
  aliceAtStaging,
  target,
  outboundAction,
  defender,
  bobHome,
  clients,
  turnProcessor,
}: AssertActionSelectionsInput): Promise<void> {
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceFinalView.turn,
    submittedActionTargets: {
      actionId: inboundAction.id,
      selectedTargets: { fleet: aliceAtStaging.id, planet: target.id },
      selectedInputs: { strength: 5 },
    },
  })
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceFinalView.turn,
    submittedActionTargets: {
      actionId: outboundAction.id,
      selectedTargets: { fleet: defender.id, planet: bobHome.id },
      selectedInputs: { strength: 20 },
    },
  })
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceFinalView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(aliceFinalView, BuildFleetStandard.id, { planet: target.id }),
  })
  await processPublicTurn({ clients, gameId, turn: aliceFinalView.turn, turnProcessor })
}

export type AssertActionSelectionsInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  aliceFinalView: PlayerView
  inboundAction: Action
  aliceAtStaging: Fleet
  target: Planet
  outboundAction: Action
  defender: Fleet
  bobHome: Planet
  clients: AuthenticatedApiClient[]
  turnProcessor: TurnProcessor
}

export async function assertDefenderAfter({
  defenderAfter,
  defender,
  outboundJourney,
  target,
  bobHome,
  afterCombat,
  playerIds,
  aliceAtStaging,
  enemyJourney,
  clients,
  gameId,
  turnProcessor,
  db,
  clock,
  turnsRepository,
  alice,
}: AssertDefenderAfterInput): Promise<void> {
  assertDefenderAfter2({ defenderAfter, defender, outboundJourney, target, bobHome, afterCombat, playerIds, aliceAtStaging, enemyJourney })
  const emptyTurn = afterCombat.turn
  await processPublicTurn({ clients, gameId, turn: emptyTurn, turnProcessor, process: false })
  const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(afterEmpty.fleets.find(({ id }) => id === defenderAfter.id)?.strength).toBe(5)
  expect(afterEmpty.fleets.find(({ id }) => id === outboundJourney.id)?.strength).toBe(20)
}

export type AssertDefenderAfterInput = {
  defenderAfter: Fleet
  defender: Fleet
  outboundJourney: Fleet
  target: Planet
  bobHome: Planet
  afterCombat: PlayerView
  playerIds: PlayerId[]
  aliceAtStaging: Fleet
  enemyJourney: Fleet
  clients: AuthenticatedApiClient[]
  gameId: GameId
  turnProcessor: TurnProcessor
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  alice: AuthenticatedApiClient
}

export type AssertDefenderAfter2Input = {
  defenderAfter: Fleet
  defender: Fleet
  outboundJourney: Fleet
  target: Planet
  bobHome: Planet
  afterCombat: PlayerView
  playerIds: PlayerId[]
  aliceAtStaging: Fleet
  enemyJourney: Fleet
}

export function assertDefenderAfter2({
  defenderAfter,
  defender,
  outboundJourney,
  target,
  bobHome,
  afterCombat,
  playerIds,
  aliceAtStaging,
  enemyJourney,
}: AssertDefenderAfter2Input): void {
  expect(defenderAfter).toMatchObject({ id: defender.id, name: defender.name, strength: 5 })
  expect(outboundJourney).toMatchObject({
    strength: 20,
    originPlanetId: target.id,
    destinationPlanetId: bobHome.id,
    movement: { speed: 0.1 },
    distanceToEnd: 4.318312565270031,
  })
  expect(afterCombat.fleets.some(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])).toBe(false)
  expect(afterCombat.fleets.find(({ id }) => id === aliceAtStaging.id)?.strength).toBe(5)
  expect(
    afterCombat.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)?.ownerPlayerId,
  ).toBe(playerIds[0])
  expect(afterCombat.actions.find(({ id }) => id === enemyJourney.movement?.submission.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}
