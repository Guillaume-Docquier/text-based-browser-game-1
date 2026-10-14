import type { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import { asc, eq } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { NonNegativeSafeInteger } from "shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetImproved } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Action, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import {
  actionsTable,
  fleetsTable,
  gamesTable,
  planetsTable,
  playersTable,
  resourcesTable,
  starsTable,
  turnsTable,
} from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getActionToSubmintegrationTest } from "../fleet-worker/TurnProcessor.scenarios.ts"
import type { AssertSourceFleet2Input, AssertTurnProcessor2Input } from "./TurnProcessor.assault-sources.ts"

export async function assertUpdatedRows({
  db,
  corruptedMovement,
  journey,
  gameId,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  departedView,
}: AssertUpdatedRowsInput): Promise<void> {
  const updatedRows = await db
    .update(fleetsTable)
    .set({ movement: corruptedMovement })
    .where(eq(fleetsTable.id, journey.id))
    .returning({ id: fleetsTable.id })

  expect(updatedRows).toStrictEqual([{ id: journey.id }])

  const readPersistedGameState = async (): Promise<{
    games: Array<typeof gamesTable.$inferSelect>
    players: Array<typeof playersTable.$inferSelect>
    resources: Array<typeof resourcesTable.$inferSelect>
    actions: Array<typeof actionsTable.$inferSelect>
    stars: Array<typeof starsTable.$inferSelect>
    planets: Array<typeof planetsTable.$inferSelect>
    fleets: Array<typeof fleetsTable.$inferSelect>
  }> => {
    const [games, players, resources, actions, stars, planets, fleets] = await Promise.all([
      db.select().from(gamesTable).where(eq(gamesTable.id, gameId)),
      db.select().from(playersTable).where(eq(playersTable.gameId, gameId)).orderBy(asc(playersTable.playerId)),
      db
        .select()
        .from(resourcesTable)
        .where(eq(resourcesTable.gameId, gameId))
        .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
      db
        .select()
        .from(actionsTable)
        .where(eq(actionsTable.gameId, gameId))
        .orderBy(asc(actionsTable.playerId), asc(actionsTable.turn), asc(actionsTable.id)),
      db.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(asc(starsTable.id)),
      db.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(asc(planetsTable.id)),
      db.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)).orderBy(asc(fleetsTable.id)),
    ])
    return { games, players, resources, actions, stars, planets, fleets }
  }

  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  const gameStateBeforeFailure = await readPersistedGameState()
  const turnsBeforeFailure = await db
    .select({ turn: turnsTable.turn, status: turnsTable.status })
    .from(turnsTable)
    .where(eq(turnsTable.gameId, gameId))
    .orderBy(asc(turnsTable.turn))

  // Act
  const processingResult = await turnProcessor.processNextDueTurn()

  // Assert
  expect(processingResult).toBe("failed")
  expect(await readPersistedGameState()).toStrictEqual(gameStateBeforeFailure)
  const turnsAfterFailure = await db
    .select({ turn: turnsTable.turn, status: turnsTable.status })
    .from(turnsTable)
    .where(eq(turnsTable.gameId, gameId))
    .orderBy(asc(turnsTable.turn))
  expect(turnsAfterFailure).toStrictEqual(
    turnsBeforeFailure.map((turn) => (turn.turn === departedView.turn ? { ...turn, status: "PROCESSING" } : turn)),
  )
  expect((await db.select().from(fleetsTable).where(eq(fleetsTable.id, journey.id)))[0]?.movement).toStrictEqual(corruptedMovement)
}

export type AssertUpdatedRowsInput = {
  db: Database
  corruptedMovement: {
    speed: PositiveNumber
    departureTurn: PositiveInteger
    submission: {
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: Readonly<Record<TargetTag, PlayerId | PlanetId | FleetId>>
      selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
    }
    pendingArrivalEffects: ReadonlyArray<
      | {
          effectDefinition: {
            type: "FLEET_ASSAULT"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: Record<string, never>
          }
          definitionOrdinal: NonNegativeSafeInteger
        }
      | {
          effectDefinition: {
            type: "FLEET_COLONIZE"
            targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
            parameters: { strengthRequirement: PositiveInteger }
          }
          definitionOrdinal: NonNegativeSafeInteger
        }
    >
  }
  journey: Fleet
  gameId: GameId
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  departedView: PlayerView
}

export async function assertSourceFleet2({
  sourceFleet,
  firstMove,
  secondMove,
  player,
  gameId,
  fleetView,
  destination,
  immediateMove,
  quickDestination,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
}: AssertSourceFleet2Input): Promise<void> {
  expect(sourceFleet.strength).toBe(50)

  // Act
  // Reserve 20 + 15 from one source Fleet. Replacing 15 with 31 would overcommit it by one.
  for (const [action, strength] of [
    [firstMove, 20],
    [secondMove, 15],
  ] as const) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: fleetView.turn,
      submittedActionTargets: {
        actionId: action.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength },
      },
    })
  }
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: fleetView.turn,
      submittedActionTargets: {
        actionId: secondMove.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 31 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: fleetView.turn,
    submittedActionTargets: {
      actionId: immediateMove.id,
      selectedTargets: { fleet: sourceFleet.id, planet: quickDestination.id },
      selectedInputs: { strength: 1 },
    },
  })
  const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId })

  // Assert
  expect(beforeDeparture.actions.find(({ id }) => id === firstMove.id)?.selectedInputs).toStrictEqual({ strength: 20 })
  expect(beforeDeparture.actions.find(({ id }) => id === secondMove.id)?.selectedInputs).toStrictEqual({ strength: 15 })
  expect(beforeDeparture.actions.find(({ id }) => id === immediateMove.id)).toMatchObject({
    selectedTargets: { fleet: sourceFleet.id, planet: quickDestination.id },
    selectedInputs: { strength: 1 },
  })

  // Resolve both accepted allocations and verify the untouched source remainder survived persistence.
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertStationaryRemainder({
  stationaryRemainder,
  origin,
  otherStationaryFleet,
  quickDestination,
  inTransitView,
  firstOccupied,
  secondOccupied,
  freeThird,
  immediateMove,
  player,
  gameId,
}: AssertStationaryRemainderInput): Promise<void> {
  assertStationaryRemainder2({
    stationaryRemainder,
    origin,
    otherStationaryFleet,
    quickDestination,
    inTransitView,
    firstOccupied,
    secondOccupied,
    freeThird,
    immediateMove,
  })

  // Prove the other stationary Fleet and return target are valid with the free instance,
  // cancel that draft, then try the same selection on the occupied instance.
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: inTransitView.turn,
    submittedActionTargets: {
      actionId: freeThird.id,
      selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
      selectedInputs: { strength: 1 },
    },
  })
  const validRedirectReference = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(validRedirectReference.actions.find(({ id }) => id === freeThird.id)).toMatchObject({
    selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
    selectedInputs: { strength: 1 },
  })
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: inTransitView.turn,
    submittedActionTargets: { actionId: freeThird.id, selectedTargets: null, selectedInputs: null },
  })
}

export type AssertStationaryRemainderInput = {
  stationaryRemainder: Fleet
  origin: Planet
  otherStationaryFleet: Fleet
  quickDestination: Planet
  inTransitView: PlayerView
  firstOccupied: Action
  secondOccupied: Action
  freeThird: Action
  immediateMove: Action
  player: AuthenticatedApiClient
  gameId: GameId
}

export type AssertStationaryRemainder2Input = {
  stationaryRemainder: Fleet
  origin: Planet
  otherStationaryFleet: Fleet
  quickDestination: Planet
  inTransitView: PlayerView
  firstOccupied: Action
  secondOccupied: Action
  freeThird: Action
  immediateMove: Action
}

export function assertStationaryRemainder2({
  stationaryRemainder,
  origin,
  otherStationaryFleet,
  quickDestination,
  inTransitView,
  firstOccupied,
  secondOccupied,
  freeThird,
  immediateMove,
}: AssertStationaryRemainder2Input): void {
  expect(stationaryRemainder).toMatchObject({ strength: 14, originPlanetId: origin.id })
  expect(otherStationaryFleet).toMatchObject({ strength: 1, originPlanetId: quickDestination.id })
  expect(otherStationaryFleet.id).not.toBe(stationaryRemainder.id)
  expect(inTransitView.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([1, 14, 15, 20])
  expect(
    inTransitView.fleets
      .filter(({ movement }) => movement !== undefined)
      .map(({ strength }) => strength)
      .toSorted((first, second) => first - second),
  ).toStrictEqual([15, 20])
  expect(firstOccupied.isInProgress).toBe(true)
  expect(secondOccupied.isInProgress).toBe(true)
  expect(freeThird.isInProgress).toBe(false)
  expect(inTransitView.actions.find(({ id }) => id === immediateMove.id)?.isInProgress).toBe(false)
}

export async function assertPlayer({
  player,
  gameId,
  inTransitView,
  freeThird,
  journeyFleet,
  destination,
  beforeOccupiedRedirect,
  stationaryRemainder,
  firstOccupied,
  secondOccupied,
  otherStationaryFleet,
  quickDestination,
}: AssertPlayerInput): Promise<void> {
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: inTransitView.turn,
      submittedActionTargets: {
        actionId: freeThird.id,
        selectedTargets: { fleet: journeyFleet.id, planet: destination.id },
        selectedInputs: { strength: 1 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOccupiedRedirect)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: inTransitView.turn,
    submittedActionTargets: {
      actionId: freeThird.id,
      selectedTargets: { fleet: stationaryRemainder.id, planet: destination.id },
      selectedInputs: { strength: 14 },
    },
  })

  const updatedView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(updatedView.actions.find(({ id }) => id === firstOccupied.id)?.isInProgress).toBe(true)
  expect(updatedView.actions.find(({ id }) => id === secondOccupied.id)?.isInProgress).toBe(true)
  expect(updatedView.actions.find(({ id }) => id === freeThird.id)?.isInProgress).toBe(false)
  expect(updatedView.actions.find(({ id }) => id === freeThird.id)?.selectedInputs).toStrictEqual({ strength: 14 })
  expect(updatedView.fleets.find(({ id }) => id === otherStationaryFleet.id)).toMatchObject({
    strength: 1,
    originPlanetId: quickDestination.id,
  })
}

export type AssertPlayerInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  inTransitView: PlayerView
  freeThird: Action
  journeyFleet: Fleet
  destination: Planet
  beforeOccupiedRedirect: PlayerView
  stationaryRemainder: Fleet
  firstOccupied: Action
  secondOccupied: Action
  otherStationaryFleet: Fleet
  quickDestination: Planet
}

export async function assertTurnProcessor2({
  player,
  gameId,
  initialView,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  homePlanet,
}: AssertTurnProcessor2Input): Promise<void> {
  for (const actionDefinitionId of [GainInfluence.id, GainMetal.id]) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(initialView, actionDefinitionId),
    })
  }
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const fundedView = await player.client.gameplay.getPlayerView.query({ gameId })

  for (const submittedActionTargets of [
    getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: homePlanet.id }),
    getActionToSubmintegrationTest(fundedView, GainFuel.id),
    getActionToSubmintegrationTest(fundedView, GainInfluence.id),
  ]) {
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: fundedView.turn,
      submittedActionTargets,
    })
  }
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertReturnView({
  returnView,
  stationedFleet,
  movingFleet,
  player,
  gameId,
  departedFleet,
  homePlanet,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
}: AssertReturnViewInput): Promise<void> {
  expect(returnView.fleets).toHaveLength(2)
  expect(stationedFleet.id).not.toBe(movingFleet.id)
  expect(returnView.fleets.map(({ strength }) => strength)).toStrictEqual([10, 10])

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: returnView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      returnView,
      MoveFleetImproved.id,
      {
        fleet: departedFleet.id,
        planet: homePlanet.id,
      },
      { strength: departedFleet.strength },
    ),
  })

  // Act
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  const turnResult = await turnProcessor.processNextDueTurn()
  const playerView = await player.client.gameplay.getPlayerView.query({ gameId })

  // Assert
  expect(turnResult).toBe("processed")
  expect(playerView.turn).toBe(6)
  expect(playerView.fleets).toStrictEqual([
    {
      ...stationedFleet,
      strength: 20,
    },
  ])
}

export type AssertReturnViewInput = {
  returnView: PlayerView
  stationedFleet: Fleet
  movingFleet: Fleet
  player: AuthenticatedApiClient
  gameId: GameId
  departedFleet: Fleet
  homePlanet: Planet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

export function assertPersistedDefenderHome({
  persistedDefenderHome,
  defenderPlayerId,
  resolvedView,
  persistedEnemyFleet,
  defendingFleet,
  defenderHome,
  persistedArrival,
  attackerPlayerId,
  attackingFleet,
  moveAction,
}: AssertPersistedDefenderHomeInput): void {
  expect(persistedDefenderHome.ownerPlayerId).toBe(defenderPlayerId)
  expect(resolvedView.fleets).toHaveLength(2)
  expect(persistedEnemyFleet).toStrictEqual({
    id: defendingFleet.id,
    name: defendingFleet.name,
    ownerPlayerId: defenderPlayerId,
    strength: 7,
    originPlanetId: defenderHome.id,
  })
  expect(persistedArrival).toMatchObject({
    ownerPlayerId: attackerPlayerId,
    strength: 20,
    originPlanetId: defenderHome.id,
  })
  expect(persistedArrival.id).not.toBe(attackingFleet.id)
  expect(persistedArrival).not.toHaveProperty("movement")
  expect(persistedArrival).not.toHaveProperty("destinationPlanetId")
  expect(persistedArrival).not.toHaveProperty("distanceToEnd")
  expect(resolvedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(false)
}

export type AssertPersistedDefenderHomeInput = {
  persistedDefenderHome: Planet
  defenderPlayerId: PlayerId
  resolvedView: PlayerView
  persistedEnemyFleet: Fleet
  defendingFleet: Fleet
  defenderHome: Planet
  persistedArrival: Fleet
  attackerPlayerId: PlayerId
  attackingFleet: Fleet
  moveAction: Action
}
