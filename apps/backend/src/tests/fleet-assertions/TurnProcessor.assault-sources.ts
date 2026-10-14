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

export async function assertTurnProcessor(input: AssertTurnProcessorInput): Promise<void> {
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
    getActionToSubmintegrationTest(fundedView, BuildFleetStandard.id, { planet: input.origin.id }),
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

export async function assertInTransitAction(input: AssertInTransitActionInput): Promise<void> {
  await assertInTransitAction2({ ...input })
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  const secondTurnResult = await input.turnProcessor.processNextDueTurn()
  const landedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })

  // Assert

  assertFirstTurnResult({ ...input, secondTurnResult, landedView })
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

export async function assertInTransitAction2(input: AssertInTransitAction2Input): Promise<void> {
  expect(input.inTransitAction.isInProgress).toBe(true)
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.inTransitView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        input.inTransitView,
        MoveFleetImproved.id,
        { fleet: input.journey.id, planet: input.origin.id },
        { strength: 1 },
      ),
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.inTransitView.turn,
      submittedActionTargets: { actionId: input.inTransitAction.id, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
}

export function assertFirstTurnResult(input: AssertFirstTurnResultInput): void {
  expect(input.firstTurnResult).toBe("processed")
  expect(input.secondTurnResult).toBe("processed")
  expect(input.inTransitView.turn).toBe(4)
  expect(input.inTransitView.fleets).toHaveLength(1)
  expect(input.journey).toMatchObject({
    ownerPlayerId: input.player.account.id,
    strength: input.fleet.strength,
    originPlanetId: input.origin.id,
    destinationPlanetId: input.destination.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
  })
  expect(input.journey.id).not.toBe(input.fleet.id)
  expect(input.landedView.turn).toBe(5)
  expect(input.landedView.fleets).toStrictEqual([
    {
      id: input.journey.id,
      name: input.journey.name,
      ownerPlayerId: input.journey.ownerPlayerId,
      strength: input.journey.strength,
      originPlanetId: input.destination.id,
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

export async function assertSourceFleet(input: AssertSourceFleetInput): Promise<void> {
  expect(input.sourceFleet.strength).toBe(100)
  const resourcesBeforeDeparture = input.builtView.resources
  expect(resourcesBeforeDeparture).toStrictEqual({
    [ResourceType.INFLUENCE]: { total: 94, uncommitted: 94 },
    [ResourceType.METAL]: { total: 97, uncommitted: 97 },
    [ResourceType.FUEL]: { total: 100, uncommitted: 100 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
  })

  // Act
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.builtView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      input.builtView,
      MoveFleetStandard.id,
      { fleet: input.sourceFleet.id, planet: input.destination.id },
      { strength: 20 },
    ),
  })
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
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

export async function assertDepartedView(input: AssertDepartedViewInput): Promise<void> {
  assertDepartedView2({ ...input })

  // No submissions are made in either continuation turn; each reload reads the saved journey.
  // Act
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
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

export function assertDepartedView2(input: AssertDepartedView2Input): void {
  expect(input.departedView.resources).toStrictEqual(input.expectedResourcesAfterPayment)
  expect(input.remainder).toMatchObject({ strength: 80, originPlanetId: input.origin.id })
  expect(input.journey.movement).toStrictEqual(input.expectedMovementProvenance)
  expect(input.journey).toMatchObject({
    strength: 20,
    originPlanetId: input.origin.id,
    destinationPlanetId: input.destination.id,
    distanceToEnd: expect.closeTo(0.6456435045942517, 12),
    movement: {
      speed: 0.5,
      departureTurn: input.builtView.turn,
      pendingArrivalEffects: [],
      submission: {
        id: input.moveAction.id,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.destination.id },
        selectedInputs: { strength: 20 },
      },
    },
  })
  expect(input.departedView.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(true)
}

export async function assertContinuedJourney(input: AssertContinuedJourneyInput): Promise<void> {
  expect(input.continuedJourney.movement).toStrictEqual(input.expectedMovementProvenance)
  expect(input.continuedJourney).toMatchObject({
    strength: 20,
    destinationPlanetId: input.destination.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
  })
  expect(input.continuedView.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(true)
  expect(input.continuedView.resources).toStrictEqual(input.expectedResourcesAfterPayment)

  // Act
  input.clock.increment({ time: input.turnInterval })
  await input.turnsRepository.markDueTurnsAwaitingProcessing({ since: input.clock.now() })
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const landedView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  // Assert
  expect(landedView.turn).toBe(input.builtView.turn + 3)
  expect(landedView.fleets.find(({ id }) => id === input.journey.id)).toStrictEqual({
    id: input.journey.id,
    name: input.journey.name,
    ownerPlayerId: input.journey.ownerPlayerId,
    strength: 20,
    originPlanetId: input.destination.id,
  })
  expect(landedView.fleets.find(({ id, movement }) => id === input.sourceFleet.id && movement === undefined)).toMatchObject({
    strength: 80,
    originPlanetId: input.origin.id,
  })
  expect(landedView.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(false)
  expect(landedView.resources).toStrictEqual(input.expectedResourcesAfterPayment)
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
