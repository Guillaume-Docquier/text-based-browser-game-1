import type { Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Action, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getActionToSubmintegrationTest } from "../fleet-worker/TurnProcessor.scenarios.ts"

export async function assertTurnProcessor({
  player,
  gameId,
  initialView,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  origin,
}: AssertTurnProcessorInput): Promise<void> {
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
    getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: origin.id }),
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

export type AssertTurnProcessorInput = {
  player: AuthenticatedApiClient
  gameId: GameId
  initialView: PlayerView
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  origin: Planet
}

export type AssertTurnProcessor2Input = {
  player: AuthenticatedApiClient
  gameId: GameId
  initialView: PlayerView
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  homePlanet: Planet
}

export async function assertInTransitAction({
  inTransitAction,
  player,
  gameId,
  inTransitView,
  journey,
  origin,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  firstTurnResult,
  fleet,
  destination,
}: AssertInTransitActionInput): Promise<void> {
  await assertInTransitAction2({ inTransitAction, player, gameId, inTransitView, journey, origin })
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  const secondTurnResult = await turnProcessor.processNextDueTurn()
  const landedView = await player.client.gameplay.getPlayerView.query({ gameId })

  // Assert

  assertFirstTurnResult({ firstTurnResult, secondTurnResult, inTransitView, journey, player, fleet, origin, destination, landedView })
}

export type AssertInTransitActionInput = {
  inTransitAction: Action
  player: AuthenticatedApiClient
  gameId: GameId
  inTransitView: PlayerView
  journey: Fleet
  origin: Planet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  firstTurnResult: "processed" | "idle" | "failed"
  fleet: Fleet
  destination: Planet
}

export type AssertInTransitAction2Input = {
  inTransitAction: Action
  player: AuthenticatedApiClient
  gameId: GameId
  inTransitView: PlayerView
  journey: Fleet
  origin: Planet
}

export async function assertInTransitAction2({
  inTransitAction,
  player,
  gameId,
  inTransitView,
  journey,
  origin,
}: AssertInTransitAction2Input): Promise<void> {
  expect(inTransitAction.isInProgress).toBe(true)
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: inTransitView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        inTransitView,
        MoveFleetImproved.id,
        { fleet: journey.id, planet: origin.id },
        { strength: 1 },
      ),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: inTransitView.turn,
      submittedActionTargets: { actionId: inTransitAction.id, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
}

export function assertFirstTurnResult({
  firstTurnResult,
  secondTurnResult,
  inTransitView,
  journey,
  player,
  fleet,
  origin,
  destination,
  landedView,
}: AssertFirstTurnResultInput): void {
  expect(firstTurnResult).toBe("processed")
  expect(secondTurnResult).toBe("processed")
  expect(inTransitView.turn).toBe(4)
  expect(inTransitView.fleets).toHaveLength(1)
  expect(journey).toMatchObject({
    ownerPlayerId: player.account.id,
    strength: fleet.strength,
    originPlanetId: origin.id,
    destinationPlanetId: destination.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
  })
  expect(journey.id).not.toBe(fleet.id)
  expect(landedView.turn).toBe(5)
  expect(landedView.fleets).toStrictEqual([
    {
      id: journey.id,
      name: journey.name,
      ownerPlayerId: journey.ownerPlayerId,
      strength: journey.strength,
      originPlanetId: destination.id,
    },
  ])
}

export type AssertFirstTurnResultInput = {
  firstTurnResult: "processed" | "idle" | "failed"
  secondTurnResult: "processed" | "idle" | "failed"
  inTransitView: PlayerView
  journey: Fleet
  player: AuthenticatedApiClient
  fleet: Fleet
  origin: Planet
  destination: Planet
  landedView: PlayerView
}

export async function assertSourceFleet({
  sourceFleet,
  builtView,
  player,
  gameId,
  destination,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
}: AssertSourceFleetInput): Promise<void> {
  expect(sourceFleet.strength).toBe(100)
  const resourcesBeforeDeparture = builtView.resources
  expect(resourcesBeforeDeparture).toStrictEqual({
    [ResourceType.INFLUENCE]: { total: 94, uncommitted: 94 },
    [ResourceType.METAL]: { total: 97, uncommitted: 97 },
    [ResourceType.FUEL]: { total: 100, uncommitted: 100 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
  })

  // Act
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: builtView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      builtView,
      MoveFleetStandard.id,
      { fleet: sourceFleet.id, planet: destination.id },
      { strength: 20 },
    ),
  })
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export type AssertSourceFleetInput = {
  sourceFleet: Fleet
  builtView: PlayerView
  player: AuthenticatedApiClient
  gameId: GameId
  destination: Planet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

export type AssertSourceFleet2Input = {
  sourceFleet: Fleet
  firstMove: Action
  secondMove: Action
  player: AuthenticatedApiClient
  gameId: GameId
  fleetView: PlayerView
  destination: Planet
  immediateMove: Action
  quickDestination: Planet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

export async function assertDepartedView({
  departedView,
  expectedResourcesAfterPayment,
  remainder,
  origin,
  journey,
  expectedMovementProvenance,
  destination,
  builtView,
  moveAction,
  sourceFleet,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
}: AssertDepartedViewInput): Promise<void> {
  assertDepartedView2({
    departedView,
    expectedResourcesAfterPayment,
    remainder,
    origin,
    journey,
    expectedMovementProvenance,
    destination,
    builtView,
    moveAction,
    sourceFleet,
  })

  // No submissions are made in either continuation turn; each reload reads the saved journey.
  // Act
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export type AssertDepartedViewInput = {
  departedView: PlayerView
  expectedResourcesAfterPayment: {
    INFLUENCE: { total: number; uncommitted: number }
    METAL: { total: number; uncommitted: number }
    FUEL: { total: number; uncommitted: number }
    ENERGY: { total: number; uncommitted: number }
    COLONY: { total: number; uncommitted: number }
  }
  remainder: Fleet
  origin: Planet
  journey: Fleet
  expectedMovementProvenance: {
    speed: number
    departureTurn: number
    submission: {
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: { fleet: FleetId; planet: PlanetId }
      selectedInputs: { strength: number }
    }
    pendingArrivalEffects: never[]
  }
  destination: Planet
  builtView: PlayerView
  moveAction: Action
  sourceFleet: Fleet
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
}

export type AssertDepartedView2Input = {
  departedView: PlayerView
  expectedResourcesAfterPayment: {
    INFLUENCE: { total: number; uncommitted: number }
    METAL: { total: number; uncommitted: number }
    FUEL: { total: number; uncommitted: number }
    ENERGY: { total: number; uncommitted: number }
    COLONY: { total: number; uncommitted: number }
  }
  remainder: Fleet
  origin: Planet
  journey: Fleet
  expectedMovementProvenance: {
    speed: number
    departureTurn: number
    submission: {
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: { fleet: FleetId; planet: PlanetId }
      selectedInputs: { strength: number }
    }
    pendingArrivalEffects: never[]
  }
  destination: Planet
  builtView: PlayerView
  moveAction: Action
  sourceFleet: Fleet
}

export function assertDepartedView2({
  departedView,
  expectedResourcesAfterPayment,
  remainder,
  origin,
  journey,
  expectedMovementProvenance,
  destination,
  builtView,
  moveAction,
  sourceFleet,
}: AssertDepartedView2Input): void {
  expect(departedView.resources).toStrictEqual(expectedResourcesAfterPayment)
  expect(remainder).toMatchObject({ strength: 80, originPlanetId: origin.id })
  expect(journey.movement).toStrictEqual(expectedMovementProvenance)
  expect(journey).toMatchObject({
    strength: 20,
    originPlanetId: origin.id,
    destinationPlanetId: destination.id,
    distanceToEnd: expect.closeTo(0.6456435045942517, 12),
    movement: {
      speed: 0.5,
      departureTurn: builtView.turn,
      pendingArrivalEffects: [],
      submission: {
        id: moveAction.id,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 20 },
      },
    },
  })
  expect(departedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
}

export async function assertContinuedJourney({
  continuedJourney,
  expectedMovementProvenance,
  destination,
  continuedView,
  moveAction,
  expectedResourcesAfterPayment,
  clock,
  turnInterval,
  turnsRepository,
  turnProcessor,
  player,
  gameId,
  builtView,
  journey,
  sourceFleet,
  origin,
}: AssertContinuedJourneyInput): Promise<void> {
  expect(continuedJourney.movement).toStrictEqual(expectedMovementProvenance)
  expect(continuedJourney).toMatchObject({
    strength: 20,
    destinationPlanetId: destination.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
  })
  expect(continuedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
  expect(continuedView.resources).toStrictEqual(expectedResourcesAfterPayment)

  // Act
  clock.increment({ time: turnInterval })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const landedView = await player.client.gameplay.getPlayerView.query({ gameId })
  // Assert
  expect(landedView.turn).toBe(builtView.turn + 3)
  expect(landedView.fleets.find(({ id }) => id === journey.id)).toStrictEqual({
    id: journey.id,
    name: journey.name,
    ownerPlayerId: journey.ownerPlayerId,
    strength: 20,
    originPlanetId: destination.id,
  })
  expect(landedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)).toMatchObject({
    strength: 80,
    originPlanetId: origin.id,
  })
  expect(landedView.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(false)
  expect(landedView.resources).toStrictEqual(expectedResourcesAfterPayment)
}

export type AssertContinuedJourneyInput = {
  continuedJourney: Fleet
  expectedMovementProvenance: {
    speed: number
    departureTurn: number
    submission: {
      id: ActionId
      playerId: PlayerId
      actionDefinitionId: ActionDefinitionId
      selectedTargets: { fleet: FleetId; planet: PlanetId }
      selectedInputs: { strength: number }
    }
    pendingArrivalEffects: never[]
  }
  destination: Planet
  continuedView: PlayerView
  moveAction: Action
  expectedResourcesAfterPayment: {
    INFLUENCE: { total: number; uncommitted: number }
    METAL: { total: number; uncommitted: number }
    FUEL: { total: number; uncommitted: number }
    ENERGY: { total: number; uncommitted: number }
    COLONY: { total: number; uncommitted: number }
  }
  clock: ControlledClock
  turnInterval: Time<UnitOfTime.SECONDS>
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  journey: Fleet
  sourceFleet: Fleet
  origin: Planet
}
