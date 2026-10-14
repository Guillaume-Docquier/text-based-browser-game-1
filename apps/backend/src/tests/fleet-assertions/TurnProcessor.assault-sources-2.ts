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

export async function assertUpdatedRows(input: AssertUpdatedRowsInput): Promise<void> {
  const updatedRows = await input.db
    .update(fleetsTable)
    .set({ movement: input.corruptedMovement })
    .where(eq(fleetsTable.id, input.journey.id))
    .returning({ id: fleetsTable.id })

  expect(updatedRows).toStrictEqual([{ id: input.journey.id }])

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
      input.db.select().from(gamesTable).where(eq(gamesTable.id, input.gameId)),
      input.db.select().from(playersTable).where(eq(playersTable.gameId, input.gameId)).orderBy(asc(playersTable.playerId)),
      input.db
        .select()
        .from(resourcesTable)
        .where(eq(resourcesTable.gameId, input.gameId))
        .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
      input.db
        .select()
        .from(actionsTable)
        .where(eq(actionsTable.gameId, input.gameId))
        .orderBy(asc(actionsTable.playerId), asc(actionsTable.turn), asc(actionsTable.id)),
      input.db.select().from(starsTable).where(eq(starsTable.gameId, input.gameId)).orderBy(asc(starsTable.id)),
      input.db.select().from(planetsTable).where(eq(planetsTable.gameId, input.gameId)).orderBy(asc(planetsTable.id)),
      input.db.select().from(fleetsTable).where(eq(fleetsTable.gameId, input.gameId)).orderBy(asc(fleetsTable.id)),
    ])
    return { games, players, resources, actions, stars, planets, fleets }
  }

  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  const gameStateBeforeFailure = await readPersistedGameState()
  const turnsBeforeFailure = await input.db
    .select({ turn: turnsTable.turn, status: turnsTable.status })
    .from(turnsTable)
    .where(eq(turnsTable.gameId, input.gameId))
    .orderBy(asc(turnsTable.turn))

  // Act
  const processingResult = await input.turnProcessor.processNextDueTurn()

  // Assert
  expect(processingResult).toBe("failed")
  expect(await readPersistedGameState()).toStrictEqual(gameStateBeforeFailure)
  const turnsAfterFailure = await input.db
    .select({ turn: turnsTable.turn, status: turnsTable.status })
    .from(turnsTable)
    .where(eq(turnsTable.gameId, input.gameId))
    .orderBy(asc(turnsTable.turn))
  expect(turnsAfterFailure).toStrictEqual(
    turnsBeforeFailure.map((turn) => (turn.turn === input.departedView.turn ? { ...turn, status: "PROCESSING" } : turn)),
  )
  expect((await input.db.select().from(fleetsTable).where(eq(fleetsTable.id, input.journey.id)))[0]?.movement).toStrictEqual(
    input.corruptedMovement,
  )
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

export async function assertSourceFleet2(input: AssertSourceFleet2Input): Promise<void> {
  expect(input.sourceFleet.strength).toBe(50)

  // Act
  // Reserve 20 + 15 from one source Fleet. Replacing 15 with 31 would overcommit it by one.
  for (const [action, strength] of [
    [input.firstMove, 20],
    [input.secondMove, 15],
  ] as const) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.fleetView.turn,
      submittedActionTargets: {
        actionId: action.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength },
      },
    })
  }
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.fleetView.turn,
      submittedActionTargets: {
        actionId: input.secondMove.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength: 31 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.fleetView.turn,
    submittedActionTargets: {
      actionId: input.immediateMove.id,
      selectedTargets: { fleet: input.sourceFleet.id, planet: input.quickDestination.id },
      selectedInputs: { strength: 1 },
    },
  })
  const beforeDeparture = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  // Assert
  expect(beforeDeparture.actions.find(({ id }) => id === input.firstMove.id)?.selectedInputs).toStrictEqual({ strength: 20 })
  expect(beforeDeparture.actions.find(({ id }) => id === input.secondMove.id)?.selectedInputs).toStrictEqual({ strength: 15 })
  expect(beforeDeparture.actions.find(({ id }) => id === input.immediateMove.id)).toMatchObject({
    selectedTargets: { fleet: input.sourceFleet.id, planet: input.quickDestination.id },
    selectedInputs: { strength: 1 },
  })

  // Resolve both accepted allocations and verify the untouched source remainder survived persistence.
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertStationaryRemainder(input: AssertStationaryRemainderInput): Promise<void> {
  assertStationaryRemainder2({ ...input })

  // Prove the other stationary Fleet and return target are valid with the free instance,
  // cancel that draft, then try the same selection on the occupied instance.
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.inTransitView.turn,
    submittedActionTargets: {
      actionId: input.freeThird.id,
      selectedTargets: { fleet: input.otherStationaryFleet.id, planet: input.origin.id },
      selectedInputs: { strength: 1 },
    },
  })
  const validRedirectReference = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(validRedirectReference.actions.find(({ id }) => id === input.freeThird.id)).toMatchObject({
    selectedTargets: { fleet: input.otherStationaryFleet.id, planet: input.origin.id },
    selectedInputs: { strength: 1 },
  })
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.inTransitView.turn,
    submittedActionTargets: { actionId: input.freeThird.id, selectedTargets: null, selectedInputs: null },
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

export function assertStationaryRemainder2(input: AssertStationaryRemainder2Input): void {
  expect(input.stationaryRemainder).toMatchObject({ strength: 14, originPlanetId: input.origin.id })
  expect(input.otherStationaryFleet).toMatchObject({ strength: 1, originPlanetId: input.quickDestination.id })
  expect(input.otherStationaryFleet.id).not.toBe(input.stationaryRemainder.id)
  expect(input.inTransitView.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([
    1, 14, 15, 20,
  ])
  expect(
    input.inTransitView.fleets
      .filter(({ movement }) => movement !== undefined)
      .map(({ strength }) => strength)
      .toSorted((first, second) => first - second),
  ).toStrictEqual([15, 20])
  expect(input.firstOccupied.isInProgress).toBe(true)
  expect(input.secondOccupied.isInProgress).toBe(true)
  expect(input.freeThird.isInProgress).toBe(false)
  expect(input.inTransitView.actions.find(({ id }) => id === input.immediateMove.id)?.isInProgress).toBe(false)
}

export async function assertPlayer(input: AssertPlayerInput): Promise<void> {
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.inTransitView.turn,
      submittedActionTargets: {
        actionId: input.freeThird.id,
        selectedTargets: { fleet: input.journeyFleet.id, planet: input.destination.id },
        selectedInputs: { strength: 1 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(input.beforeOccupiedRedirect)
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.inTransitView.turn,
    submittedActionTargets: {
      actionId: input.freeThird.id,
      selectedTargets: { fleet: input.stationaryRemainder.id, planet: input.destination.id },
      selectedInputs: { strength: 14 },
    },
  })

  const updatedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(updatedView.actions.find(({ id }) => id === input.firstOccupied.id)?.isInProgress).toBe(true)
  expect(updatedView.actions.find(({ id }) => id === input.secondOccupied.id)?.isInProgress).toBe(true)
  expect(updatedView.actions.find(({ id }) => id === input.freeThird.id)?.isInProgress).toBe(false)
  expect(updatedView.actions.find(({ id }) => id === input.freeThird.id)?.selectedInputs).toStrictEqual({ strength: 14 })
  expect(updatedView.fleets.find(({ id }) => id === input.otherStationaryFleet.id)).toMatchObject({
    strength: 1,
    originPlanetId: input.quickDestination.id,
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

export async function assertTurnProcessor2(input: AssertTurnProcessor2Input): Promise<void> {
  for (const actionDefinitionId of [GainInfluence.id, GainMetal.id]) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.initialView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(input.initialView, actionDefinitionId),
    })
  }
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const fundedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  for (const submittedActionTargets of [
    getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: input.homePlanet.id }),
    getActionToSubmintegrationTest(fundedView, GainFuel.id),
    getActionToSubmintegrationTest(fundedView, GainInfluence.id),
  ]) {
    await input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: fundedView.turn,
      submittedActionTargets,
    })
  }
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertReturnView(input: AssertReturnViewInput): Promise<void> {
  expect(input.returnView.fleets).toHaveLength(2)
  expect(input.stationedFleet.id).not.toBe(input.movingFleet.id)
  expect(input.returnView.fleets.map(({ strength }) => strength)).toStrictEqual([10, 10])

  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.returnView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      input.returnView,
      MoveFleetImproved.id,
      {
        fleet: input.departedFleet.id,
        planet: input.homePlanet.id,
      },
      { strength: input.departedFleet.strength },
    ),
  })

  // Act
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  const turnResult = await input.turnProcessor.processNextDueTurn()
  const playerView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  // Assert
  expect(turnResult).toBe("processed")
  expect(playerView.turn).toBe(6)
  expect(playerView.fleets).toStrictEqual([
    {
      ...input.stationedFleet,
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

export function assertPersistedDefenderHome(input: AssertPersistedDefenderHomeInput): void {
  expect(input.persistedDefenderHome.ownerPlayerId).toBe(input.defenderPlayerId)
  expect(input.resolvedView.fleets).toHaveLength(2)
  expect(input.persistedEnemyFleet).toStrictEqual({
    id: input.defendingFleet.id,
    name: input.defendingFleet.name,
    ownerPlayerId: input.defenderPlayerId,
    strength: 7,
    originPlanetId: input.defenderHome.id,
  })
  expect(input.persistedArrival).toMatchObject({
    ownerPlayerId: input.attackerPlayerId,
    strength: 20,
    originPlanetId: input.defenderHome.id,
  })
  expect(input.persistedArrival.id).not.toBe(input.attackingFleet.id)
  expect(input.persistedArrival).not.toHaveProperty("movement")
  expect(input.persistedArrival).not.toHaveProperty("destinationPlanetId")
  expect(input.persistedArrival).not.toHaveProperty("distanceToEnd")
  expect(input.resolvedView.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(false)
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
