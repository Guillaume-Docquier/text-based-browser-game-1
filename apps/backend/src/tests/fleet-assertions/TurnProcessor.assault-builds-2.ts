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

export async function assertActionSelections(input: AssertActionSelectionsInput): Promise<void> {
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.aliceFinalView.turn,
    submittedActionTargets: {
      actionId: input.inboundAction.id,
      selectedTargets: { fleet: input.aliceAtStaging.id, planet: input.target.id },
      selectedInputs: { strength: 5 },
    },
  })
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.aliceFinalView.turn,
    submittedActionTargets: {
      actionId: input.outboundAction.id,
      selectedTargets: { fleet: input.defender.id, planet: input.bobHome.id },
      selectedInputs: { strength: 20 },
    },
  })
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.aliceFinalView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(input.aliceFinalView, BuildFleetStandard.id, { planet: input.target.id }),
  })
  await processPublicTurn({ ...input, turn: input.aliceFinalView.turn })
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

export async function assertDefenderAfter(input: AssertDefenderAfterInput): Promise<void> {
  assertDefenderAfter2({ ...input })
  const emptyTurn = input.afterCombat.turn
  await processPublicTurn({ ...input, turn: emptyTurn, process: false })
  const emptyObserved = await observeTurnAndRollback({ ...input, turn: emptyTurn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmpty = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(afterEmpty.fleets.find(({ id }) => id === input.defenderAfter.id)?.strength).toBe(5)
  expect(afterEmpty.fleets.find(({ id }) => id === input.outboundJourney.id)?.strength).toBe(20)
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

export function assertDefenderAfter2(input: AssertDefenderAfter2Input): void {
  expect(input.defenderAfter).toMatchObject({ id: input.defender.id, name: input.defender.name, strength: 5 })
  expect(input.outboundJourney).toMatchObject({
    strength: 20,
    originPlanetId: input.target.id,
    destinationPlanetId: input.bobHome.id,
    movement: { speed: 0.1 },
    distanceToEnd: 4.318312565270031,
  })
  expect(input.afterCombat.fleets.some(({ ownerPlayerId }) => ownerPlayerId === input.playerIds[1])).toBe(false)
  expect(input.afterCombat.fleets.find(({ id }) => id === input.aliceAtStaging.id)?.strength).toBe(5)
  expect(
    input.afterCombat.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === input.target.id)
      ?.ownerPlayerId,
  ).toBe(input.playerIds[0])
  expect(input.afterCombat.actions.find(({ id }) => id === input.enemyJourney.movement?.submission.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}
