import { Assert } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { required } from "shared/testing/required.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { PlayerView, Fleet, Planet } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { mulberry32FirstDraw, replayObservedTurn, mulberry32DrawSequence } from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { assertEmptyObserved3 } from "../tests/fleet-assertions/TurnProcessor-2.ts"
import {
  createClientsSetup,
  createStationedSetup,
  createObservedSetup,
  createObservedSetup2,
  createAfterCombatViewsSetup,
  createObservedSetup3,
  createAfterCombatViewsSetup2,
} from "../tests/fleet-assertions/TurnProcessor.stages.ts"
import { assertOutcomeB, assertEmptyObserved, assertEmptyObserved2 } from "../tests/fleet-assertions/TurnProcessor.ts"
import { createThreeOwnerStationedAssaultFixture, getActionToSubmintegrationTest } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { AssaultWorkerRuleset } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
  integrationTest(
    "should observe and replay the public same-pool two-owner Assault tie before the real worker saves it",
    async ({ db }) => {
      // Arrange: create stable public owners and the fixed seed-147 public map through supported API routes.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })

      const clientsSetup1 = await createClientsSetup({ apiServer, alice, db, clock })
      const { clients, gameId } = clientsSetup1

      // Act: move the non-target owner's complete fleet to the fixed target through a public ordinary Move order.

      const stationedSetup2 = await createStationedSetup({ ...clientsSetup1, alice })

      await submitStationaryAssaults({ ...clientsSetup1, ...stationedSetup2 })

      const observedSetup3 = await createObservedSetup({
        ...clientsSetup1,
        ...stationedSetup2,
        db,
        clock,
      })

      await assertOutcomeB({ ...clientsSetup1, ...stationedSetup2, ...observedSetup3 })

      const afterCombatViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))

      verifyAfterCombatViews({ ...clientsSetup1, ...stationedSetup2, afterCombatViews })

      // Assert: the next publicly closed empty turn observes the saved one-draw RNG and an empty action list.
      const emptyTurn = afterCombatViews[0]
      Assert.isDefined(emptyTurn)

      await assertEmptyObservedValue1({
        ...clientsSetup1,
        ...stationedSetup2,
        ...observedSetup3,
        emptyTurn,
        db,
        clock,
        afterCombatViews,
      })
    },
  )

  integrationTest("should persist multi-owner Build names and Assault permutations through the public worker", async ({ db }) => {
    // Arrange: stage the same public seed-147 stationary A30/B20/C10 vector for both tie scenarios.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
    using apiServer = new ApiServer(apiServices)
    const { clients, playerIds, gameId, turnProcessor, turnsRepository, target, homes, stationed } =
      await createThreeOwnerStationedAssaultFixture({ db, clock, apiServer })
    const alice = clients[0]
    const playerAId = playerIds[0]
    const playerBId = playerIds[1]
    const playerCId = playerIds[2]

    const preAssaultViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const buildActionIds: string[] = []

    await verifyBuildActionIds({ clients, preAssaultViews, homes, buildActionIds, gameId })
    const assaultActionIds: string[] = []

    await submitStationaryAssaults({
      clients,
      preAssaultViews,
      stationed,
      actionIds: assaultActionIds,
      gameId,
      target,
      ownerIndices: [0, 1],
    })

    const observedSetup4 = await createObservedSetup2({
      assaultActionIds,
      preAssaultViews,
      clients,
      gameId,
      db,
      clock,
      turnsRepository,
      playerIds,
      homes,
    })

    const afterCombatViewsSetup5 = await createAfterCombatViewsSetup({
      ...observedSetup4,
      assaultActionIds,
      playerIds,
      stationed,
      target,
      playerAId,
      playerBId,
      playerCId,
      turnProcessor,
      clients,
      gameId,
    })
    const { afterCombatViews } = afterCombatViewsSetup5

    verifyActualFleet({ ...observedSetup4, ...afterCombatViewsSetup5, stationed, target })
    const actualWorkerBuildNames: string[] = []

    verifyActualBuild({
      ...observedSetup4,
      ...afterCombatViewsSetup5,
      actualWorkerBuildNames,
      clients,
      preAssaultViews,
      target,
      assaultActionIds,
    })

    // Assert: capture the next empty public turn and verify the naturally persisted one-draw RNG before the real worker.
    const emptyTurn = afterCombatViews[0]
    Assert.isDefined(emptyTurn)

    await assertEmptyObservedValue12({
      ...observedSetup4,
      ...afterCombatViewsSetup5,
      clients,
      gameId,
      emptyTurn,
      db,
      clock,
      turnsRepository,
      actualWorkerBuildNames,
      playerIds,
      buildActionIds,
      homes,
      stationed,
      assaultActionIds,
      turnProcessor,
      alice,
      target,
    })
  })

  integrationTest("should persist the three-owner Assault-only tie through public arrivals and worker reloads", async ({ db }) => {
    // Arrange: stage the same public seed-147 stationary A30/B20/C10 vector for both tie scenarios.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
    using apiServer = new ApiServer(apiServices)
    const { clients, playerIds, gameId, turnProcessor, turnsRepository, target, stationed } = await createThreeOwnerStationedAssaultFixture(
      { db, clock, apiServer },
    )
    const alice = clients[0]
    const playerAId = playerIds[0]
    const playerBId = playerIds[1]
    const playerCId = playerIds[2]

    const preAssaultViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const assaultActionIds: string[] = []

    await submitStationaryAssaults({
      clients,
      preAssaultViews,
      stationed,
      actionIds: assaultActionIds,
      gameId,
      target,
      ownerIndices: [0, 1],
    })

    const observedSetup6 = await createObservedSetup3({
      assaultActionIds,
      preAssaultViews,
      clients,
      gameId,
      db,
      clock,
      turnsRepository,
      playerIds,
      stationed,
    })

    const afterCombatViewsSetup7 = await createAfterCombatViewsSetup2({
      ...observedSetup6,
      target,
      playerIds,
      playerAId,
      playerBId,
      playerCId,
      turnProcessor,
      clients,
      gameId,
    })
    const { afterCombatViews } = afterCombatViewsSetup7
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const before = preAssaultViews[ownerIndex]
      const after = afterCombatViews[ownerIndex]
      Assert.isDefined(before)
      Assert.isDefined(after)
      expect(
        after.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)?.ownerPlayerId,
      ).toBe(target.ownerPlayerId)
      expect(after.actions.find(({ id }) => id === assaultActionIds[0])).toMatchObject({ selectedTargets: null, isInProgress: false })
      expect(after.actions.find(({ id }) => id === assaultActionIds[1])).toMatchObject({ selectedTargets: null, isInProgress: false })
      for (const resourceType of Object.values(ResourceType)) {
        expect(after.resources[resourceType].total).toBe(before.resources[resourceType].total)
      }
    }

    // Assert: capture the next empty public turn and verify the naturally persisted one-draw RNG before the real worker.
    const emptyTurn = afterCombatViews[0]
    Assert.isDefined(emptyTurn)

    await assertEmptyObservedValue13({
      ...observedSetup6,
      ...afterCombatViewsSetup7,
      clients,
      gameId,
      emptyTurn,
      db,
      clock,
      turnsRepository,
      stationed,
      playerIds,
      assaultActionIds,
      turnProcessor,
      alice,
      target,
    })
  })
})

async function submitStationaryAssaults(input: VerifyOwnerIndexInput): Promise<void> {
  for (const ownerIndex of input.ownerIndices ?? input.clients.map((_, index) => index)) {
    const client = input.clients[ownerIndex]
    const view = input.preAssaultViews[ownerIndex]
    const fleet = input.stationed[ownerIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
    Assert.isDefined(action)
    input.actionIds.push(action.id)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(view, StationaryAssaultTest.id, {
        station: fleet.id,
        battlePlanet: input.target.id,
      }),
    })
  }
}

function verifyAfterCombatViews(input: VerifyAfterCombatViewsInput): void {
  expect(
    required(
      required(input.afterCombatViews[0]).fleets.find(
        (fleet) => fleet.ownerPlayerId === input.playerIds[0] && isStationaryPublicFleet(fleet, input.target.id),
      ),
    ).strength,
  ).toBe(10)
  expect(required(input.afterCombatViews[0]).fleets.some(({ ownerPlayerId }) => ownerPlayerId === input.playerIds[1])).toBe(false)
  for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
    const before = input.preAssaultViews[ownerIndex]
    const after = input.afterCombatViews[ownerIndex]
    Assert.isDefined(before)
    Assert.isDefined(after)
    expect(
      after.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    ).toBe(input.target.ownerPlayerId)
    for (const resourceType of Object.values(ResourceType)) {
      expect(after.resources[resourceType].total).toBe(before.resources[resourceType].total)
    }
    expect(after.actions.find(({ id }) => id === input.actionIds[ownerIndex])).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
}

async function assertEmptyObservedValue1(input: AssertEmptyObservedValue1Input): Promise<void> {
  const assertEmptyObservedPhase3Value1 = input.draw.value
  const assertEmptyObservedPhase3Observed = input.observed

  await assertEmptyObserved({ ...input, assertEmptyObservedPhase3Observed, assertEmptyObservedPhase3Value1 })
}

async function verifyBuildActionIds(input: VerifyBuildActionIdsInput): Promise<void> {
  for (const ownerIndex of [2, 1, 0]) {
    const client = input.clients[ownerIndex]
    const view = input.preAssaultViews[ownerIndex]
    const home = input.homes[ownerIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    input.buildActionIds.push(buildAction.id)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
    })
  }
  expect(input.buildActionIds).toStrictEqual(["BUILD_FLEET_STANDARD_1", "BUILD_FLEET_STANDARD_1", "BUILD_FLEET_STANDARD_1"])
}

function verifyActualFleet(input: VerifyActualFleetInput): void {
  for (const originalFleet of input.stationed) {
    const expectedFleet = Object.values(input.forward.resolved.fleets).find(({ id }) => id === originalFleet.id)
    const actualFleet = input.afterCombatViews[0]?.fleets.find(({ id }) => id === originalFleet.id)
    if (expectedFleet === undefined) {
      expect(actualFleet).toBeUndefined()
    } else {
      expect(actualFleet).toMatchObject({
        id: originalFleet.id,
        name: originalFleet.name,
        ownerPlayerId: originalFleet.ownerPlayerId,
        strength: expectedFleet.strength,
        originPlanetId: input.target.id,
      })
    }
  }
}

function verifyActualBuild(input: VerifyActualBuildInput): void {
  for (const replayBuild of input.replayBuilds) {
    const actualBuild = input.afterCombatViews[0]?.fleets.find(({ id }) => id === replayBuild.id)
    Assert.isDefined(actualBuild)
    expect(actualBuild).toMatchObject(replayBuild)
    input.actualWorkerBuildNames.push(actualBuild.name)
  }
  for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
    const before = input.preAssaultViews[ownerIndex]
    const after = input.afterCombatViews[ownerIndex]
    Assert.isDefined(before)
    Assert.isDefined(after)
    expect(
      after.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    ).toBe(input.target.ownerPlayerId)
    expect(after.actions.find(({ id }) => id === input.assaultActionIds[0])).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(after.actions.find(({ id }) => id === input.assaultActionIds[1])).toMatchObject({ selectedTargets: null, isInProgress: false })
    for (const resourceType of Object.values(ResourceType)) {
      const spent = resourceType === ResourceType.INFLUENCE ? 2 : resourceType === ResourceType.METAL ? 1 : 0
      expect(after.resources[resourceType].total).toBe(before.resources[resourceType].total - spent)
    }
  }
}

async function assertEmptyObservedValue12(input: AssertEmptyObservedValue12Input): Promise<void> {
  const assertEmptyObservedPhase6Value1 = input.draw.value
  const assertEmptyObservedPhase6Observed = input.observed

  await assertEmptyObserved2({ ...input, assertEmptyObservedPhase6Observed, assertEmptyObservedPhase6Value1 })
}

async function assertEmptyObservedValue13(input: AssertEmptyObservedValue13Input): Promise<void> {
  const assertEmptyObservedPhase8Value1 = input.draw.value
  const assertEmptyObservedPhase8Observed = input.observed

  await assertEmptyObserved3({ ...input, assertEmptyObservedPhase8Observed, assertEmptyObservedPhase8Value1 })
}

type VerifyOwnerIndexInput = {
  ownerIndices?: readonly number[]
  clients: readonly AuthenticatedApiClient[]
  preAssaultViews: PlayerView[]
  stationed: readonly Fleet[]
  actionIds: string[]
  gameId: number
  target: Planet
}

type VerifyAfterCombatViewsInput = {
  afterCombatViews: PlayerView[]
  playerIds: readonly [PlayerId, PlayerId]
  target: Planet
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  preAssaultViews: PlayerView[]
  actionIds: string[]
}

type AssertEmptyObservedValue1Input = {
  draw: ReturnType<typeof mulberry32FirstDraw>
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  emptyTurn: PlayerView
  turnProcessor: TurnProcessor
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof replayObservedTurn>
  stationed: readonly [Fleet, Fleet]
  playerIds: readonly [PlayerId, PlayerId]
  actionIds: string[]
  afterCombatViews: PlayerView[]
}

type VerifyBuildActionIdsInput = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  preAssaultViews: PlayerView[]
  homes: readonly [Planet, Planet, Planet]
  buildActionIds: string[]
  gameId: number
}

type VerifyActualFleetInput = {
  stationed: readonly [Fleet, Fleet, Fleet]
  forward: ReturnType<typeof replayObservedTurn>
  afterCombatViews: PlayerView[]
  target: Planet
}

type VerifyActualBuildInput = {
  replayBuilds: Array<{ id: string; name: string; ownerPlayerId: PlayerId; originPlanetId: string; strength: number }>
  afterCombatViews: PlayerView[]
  actualWorkerBuildNames: string[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  preAssaultViews: PlayerView[]
  target: Planet
  assaultActionIds: string[]
}

type AssertEmptyObservedValue12Input = {
  draw: { value: number; nextGeneratorState: number }
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof replayObservedTurn>
  rngSequence: ReturnType<typeof mulberry32DrawSequence>
  actualWorkerBuildNames: string[]
  expectedBuildNames: string[]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  buildActionIds: string[]
  homes: readonly [Planet, Planet, Planet]
  stationed: readonly [Fleet, Fleet, Fleet]
  assaultActionIds: string[]
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  target: Planet
  actualForces: Record<string, undefined | number[]>
}

type AssertEmptyObservedValue13Input = {
  draw: ReturnType<typeof mulberry32FirstDraw>
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  forward: ReturnType<typeof replayObservedTurn>
  stationed: readonly [Fleet, Fleet, Fleet]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  assaultActionIds: string[]
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  target: Planet
  actualForces: Record<string, undefined | number[]>
}

function isStationaryPublicFleet(fleet: Fleet, planetId: Planet["id"]): boolean {
  return fleet.originPlanetId === planetId && fleet.movement === undefined
}
