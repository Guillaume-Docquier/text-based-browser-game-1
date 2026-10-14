import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Action, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { ResourceRaceRuleset, createStartGate, submitBuildAfterGate } from "../fleet-concurrency/gameplay.scenarios.ts"
import { MANUAL_WORKER_TURN_INTERVAL } from "../fleet-concurrency/gameplay.ts"
import { assertMoveOneBeforeDeparture } from "./gameplay.assault-persistence.stages.ts"

export async function createResourceGameIdSetup({
  moveOneBeforeDeparture,
  sourceFleet,
  destination,
  moveTwoBeforeDeparture,
  beforeDeparture,
  clock,
  turnProcessor,
  turnsRepository,
  player,
  strengthGameId,
  moveOne,
  moveTwo,
  origin,
}: CreateResourceGameIdSetupInput): Promise<CreateResourceGameIdSetupResult> {
  await assertMoveOneBeforeDeparture({
    moveOneBeforeDeparture,
    sourceFleet,
    destination,
    moveTwoBeforeDeparture,
    beforeDeparture,
    clock,
    turnProcessor,
    turnsRepository,
    player,
    strengthGameId,
    moveOne,
    moveTwo,
    origin,
  })

  // A separate resource-only race cannot spend the same Influence twice.
  const { createdGameId: resourceGameId } = await player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: ResourceRaceRuleset.id,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await player.client.games.startGame.mutate({ gameId: resourceGameId })
  const resourceView = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
  const resourceOrigin = resourceView.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find(({ ownerPlayerId }) => ownerPlayerId === resourceView.player.id)
  const firstBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_1")
  const secondBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_2")
  Assert.isDefined(resourceOrigin)
  Assert.isDefined(firstBuild)
  Assert.isDefined(secondBuild)
  const resourceGate = createStartGate(2)
  return { resourceGameId, resourceView, resourceOrigin, firstBuild, secondBuild, resourceGate }
}

export type CreateResourceGameIdSetupInput = {
  moveOneBeforeDeparture: Action
  sourceFleet: Fleet
  destination: Planet
  moveTwoBeforeDeparture: Action
  beforeDeparture: PlayerView
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  player: AuthenticatedApiClient
  strengthGameId: GameId
  moveOne: Action
  moveTwo: Action
  origin: Planet
}

export type CreateResourceGameIdSetupResult = {
  resourceGameId: GameId
  resourceView: PlayerView
  resourceOrigin: Planet
  firstBuild: Action
  secondBuild: Action
  resourceGate: () => Promise<void>
}

export async function createResourceResultsSetup({
  resourceGate,
  player,
  resourceGameId,
  resourceView,
  firstBuild,
  resourceOrigin,
  secondBuild,
}: CreateResourceResultsSetupInput): Promise<CreateResourceResultsSetupResult> {
  const resourceResults = await Promise.allSettled([
    submitBuildAfterGate(resourceGate, {
      client: player.client,
      gameId: resourceGameId,
      turn: resourceView.turn,
      actionId: firstBuild.id,
      planetId: resourceOrigin.id,
    }),
    submitBuildAfterGate(resourceGate, {
      client: player.client,
      gameId: resourceGameId,
      turn: resourceView.turn,
      actionId: secondBuild.id,
      planetId: resourceOrigin.id,
    }),
  ])
  expect(resourceResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
  expect(resourceResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
  const afterResourceRace = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
  expect(afterResourceRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 3, uncommitted: 1 })
  const firstBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === firstBuild.id)
  const secondBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === secondBuild.id)
  Assert.isDefined(firstBuildAfterRace)
  Assert.isDefined(secondBuildAfterRace)
  const expectedBuildSelectionByStatus = {
    fulfilled: { selectedTargets: { planet: resourceOrigin.id }, selectedInputs: {} },
    rejected: { selectedTargets: null, selectedInputs: null },
  }
  return { resourceResults, firstBuildAfterRace, secondBuildAfterRace, expectedBuildSelectionByStatus }
}

export type CreateResourceResultsSetupInput = {
  resourceGate: () => Promise<void>
  player: AuthenticatedApiClient
  resourceGameId: GameId
  resourceView: PlayerView
  firstBuild: Action
  resourceOrigin: Planet
  secondBuild: Action
}

export type CreateResourceResultsSetupResult = {
  resourceResults: [PromiseSettledResult<void>, PromiseSettledResult<void>]
  firstBuildAfterRace: Action
  secondBuildAfterRace: Action
  expectedBuildSelectionByStatus: {
    fulfilled: { selectedTargets: { planet: PlanetId }; selectedInputs: Record<string, never> }
    rejected: { selectedTargets: null; selectedInputs: null }
  }
}
