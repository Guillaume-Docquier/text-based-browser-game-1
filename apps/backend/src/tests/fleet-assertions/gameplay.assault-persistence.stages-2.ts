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
import { ResourceRaceRuleset, createStartGate, submitActionAfterGate } from "../fleet-concurrency/gameplay.scenarios.ts"
import { MANUAL_WORKER_TURN_INTERVAL } from "../fleet-concurrency/gameplay.ts"
import { assertMoveOneBeforeDeparture } from "./gameplay.assault-persistence.stages.ts"

export async function createResourceGameIdSetup(input: CreateResourceGameIdSetupInput): Promise<CreateResourceGameIdSetupResult> {
  await assertMoveOneBeforeDeparture({ ...input })

  // A separate resource-only race cannot spend the same Influence twice.
  const { createdGameId: resourceGameId } = await input.player.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: ResourceRaceRuleset.id,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1234,
    }),
  })
  await input.player.client.games.startGame.mutate({ gameId: resourceGameId })
  const resourceView = await input.player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
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

export async function createResourceResultsSetup(input: CreateResourceResultsSetupInput): Promise<CreateResourceResultsSetupResult> {
  const resourceResults = await Promise.allSettled([
    submitActionAfterGate(input.resourceGate, {
      client: input.player.client,
      submission: {
        gameId: input.resourceGameId,
        turn: input.resourceView.turn,
        submittedActionTargets: { actionId: input.firstBuild.id, selectedTargets: { planet: input.resourceOrigin.id }, selectedInputs: {} },
      },
    }),
    submitActionAfterGate(input.resourceGate, {
      client: input.player.client,
      submission: {
        gameId: input.resourceGameId,
        turn: input.resourceView.turn,
        submittedActionTargets: {
          actionId: input.secondBuild.id,
          selectedTargets: { planet: input.resourceOrigin.id },
          selectedInputs: {},
        },
      },
    }),
  ])
  expect(resourceResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
  expect(resourceResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
  const afterResourceRace = await input.player.client.gameplay.getPlayerView.query({ gameId: input.resourceGameId })
  expect(afterResourceRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 3, uncommitted: 1 })
  const firstBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === input.firstBuild.id)
  const secondBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === input.secondBuild.id)
  Assert.isDefined(firstBuildAfterRace)
  Assert.isDefined(secondBuildAfterRace)
  const expectedBuildSelectionByStatus = {
    fulfilled: { selectedTargets: { planet: input.resourceOrigin.id }, selectedInputs: {} },
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
