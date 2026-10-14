import { Assert } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
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

      const createClientsSetupPhase1Result = await createClientsSetup({ apiServer, alice, db, clock })
      const { clients, playerIds, gameId, turnProcessor, turnsRepository, target } = createClientsSetupPhase1Result

      // Act: move the non-target owner's complete fleet to the fixed target through a public ordinary Move order.

      const createStationedSetupPhase2Result = await createStationedSetup({ ...createClientsSetupPhase1Result, alice })
      const { stationed, preAssaultViews, actionIds } = createStationedSetupPhase2Result
      for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
        const client = clients[ownerIndex]
        const view = preAssaultViews[ownerIndex]
        const fleet = stationed[ownerIndex]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(fleet)
        const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
        Assert.isDefined(action)
        actionIds.push(action.id)
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, StationaryAssaultTest.id, {
            station: fleet.id,
            battlePlanet: target.id,
          }),
        })
      }

      const createObservedSetupPhase3Result = await createObservedSetup({
        ...createClientsSetupPhase1Result,
        ...createStationedSetupPhase2Result,
        db,
        clock,
      })
      const { observed, draw, forward, outcomeA, outcomeB, assertOutcomeBPhase2Value1, assertOutcomeBPhase2Observed } =
        createObservedSetupPhase3Result

      await assertOutcomeB({
        assertOutcomeBPhase2Value1,
        outcomeB,
        stationed,
        target,
        outcomeA,
        forward,
        draw,
        assertOutcomeBPhase2Observed,
        turnProcessor,
      })

      const afterCombatViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
      expect(
        afterCombatViews[0]?.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
        )?.strength,
      ).toBe(10)
      expect(afterCombatViews[0]?.fleets.some(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])).toBe(false)
      for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
        const before = preAssaultViews[ownerIndex]
        const after = afterCombatViews[ownerIndex]
        Assert.isDefined(before)
        Assert.isDefined(after)
        expect(
          after.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)?.ownerPlayerId,
        ).toBe(target.ownerPlayerId)
        for (const resourceType of Object.values(ResourceType)) {
          expect(after.resources[resourceType].total).toBe(before.resources[resourceType].total)
        }
        expect(after.actions.find(({ id }) => id === actionIds[ownerIndex])).toMatchObject({ selectedTargets: null, isInProgress: false })
      }

      // Assert: the next publicly closed empty turn observes the saved one-draw RNG and an empty action list.
      const emptyTurn = afterCombatViews[0]
      Assert.isDefined(emptyTurn)

      const assertEmptyObservedPhase3Value1 = draw.value
      const assertEmptyObservedPhase3Observed = observed

      await assertEmptyObserved({
        clients,
        gameId,
        emptyTurn,
        turnProcessor,
        db,
        clock,
        turnsRepository,
        forward,
        assertEmptyObservedPhase3Observed,
        assertEmptyObservedPhase3Value1,
        draw,
        stationed,
        playerIds,
        actionIds,
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
    for (const ownerIndex of [2, 1, 0]) {
      const client = clients[ownerIndex]
      const view = preAssaultViews[ownerIndex]
      const home = homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      buildActionIds.push(buildAction.id)
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
      })
    }
    expect(buildActionIds).toStrictEqual(["BUILD_FLEET_STANDARD_1", "BUILD_FLEET_STANDARD_1", "BUILD_FLEET_STANDARD_1"])
    const assaultActionIds: string[] = []
    for (const ownerIndex of [0, 1]) {
      const client = clients[ownerIndex]
      const view = preAssaultViews[ownerIndex]
      const fleet = stationed[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(fleet)
      const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
      Assert.isDefined(action)
      assaultActionIds.push(action.id)
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(view, StationaryAssaultTest.id, {
          station: fleet.id,
          battlePlanet: target.id,
        }),
      })
    }

    const createObservedSetupPhase4Result = await createObservedSetup2({
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
    const { observed, rngSequence, draw, forward, expectedBuildNames, replayBuilds } = createObservedSetupPhase4Result

    const createAfterCombatViewsSetupPhase5Result = await createAfterCombatViewsSetup({
      ...createObservedSetupPhase4Result,
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
    const { afterCombatViews, actualForces } = createAfterCombatViewsSetupPhase5Result
    for (const originalFleet of stationed) {
      const expectedFleet = Object.values(forward.resolved.fleets).find(({ id }) => id === originalFleet.id)
      const actualFleet = afterCombatViews[0]?.fleets.find(({ id }) => id === originalFleet.id)
      if (expectedFleet === undefined) {
        expect(actualFleet).toBeUndefined()
      } else {
        expect(actualFleet).toMatchObject({
          id: originalFleet.id,
          name: originalFleet.name,
          ownerPlayerId: originalFleet.ownerPlayerId,
          strength: expectedFleet.strength,
          originPlanetId: target.id,
        })
      }
    }
    const actualWorkerBuildNames: string[] = []
    for (const replayBuild of replayBuilds) {
      const actualBuild = afterCombatViews[0]?.fleets.find(({ id }) => id === replayBuild.id)
      Assert.isDefined(actualBuild)
      expect(actualBuild).toMatchObject(replayBuild)
      actualWorkerBuildNames.push(actualBuild.name)
    }
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
        const spent = resourceType === ResourceType.INFLUENCE ? 2 : resourceType === ResourceType.METAL ? 1 : 0
        expect(after.resources[resourceType].total).toBe(before.resources[resourceType].total - spent)
      }
    }

    // Assert: capture the next empty public turn and verify the naturally persisted one-draw RNG before the real worker.
    const emptyTurn = afterCombatViews[0]
    Assert.isDefined(emptyTurn)

    const assertEmptyObservedPhase6Value1 = draw.value
    const assertEmptyObservedPhase6Observed = observed

    await assertEmptyObserved2({
      clients,
      gameId,
      emptyTurn,
      db,
      clock,
      turnsRepository,
      forward,
      assertEmptyObservedPhase6Observed,
      rngSequence,
      actualWorkerBuildNames,
      expectedBuildNames,
      playerIds,
      buildActionIds,
      homes,
      stationed,
      assaultActionIds,
      assertEmptyObservedPhase6Value1,
      turnProcessor,
      alice,
      target,
      actualForces,
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
    for (const ownerIndex of [0, 1]) {
      const client = clients[ownerIndex]
      const view = preAssaultViews[ownerIndex]
      const fleet = stationed[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(fleet)
      const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
      Assert.isDefined(action)
      assaultActionIds.push(action.id)
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(view, StationaryAssaultTest.id, {
          station: fleet.id,
          battlePlanet: target.id,
        }),
      })
    }

    const createObservedSetupPhase6Result = await createObservedSetup3({
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
    const { observed, draw, forward } = createObservedSetupPhase6Result

    const createAfterCombatViewsSetupPhase7Result = await createAfterCombatViewsSetup2({
      ...createObservedSetupPhase6Result,
      target,
      playerIds,
      playerAId,
      playerBId,
      playerCId,
      turnProcessor,
      clients,
      gameId,
    })
    const { afterCombatViews, actualForces } = createAfterCombatViewsSetupPhase7Result
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

    const assertEmptyObservedPhase8Value1 = draw.value
    const assertEmptyObservedPhase8Observed = observed

    await assertEmptyObserved3({
      clients,
      gameId,
      emptyTurn,
      db,
      clock,
      turnsRepository,
      forward,
      assertEmptyObservedPhase8Observed,
      assertEmptyObservedPhase8Value1,
      draw,
      stationed,
      playerIds,
      assaultActionIds,
      turnProcessor,
      alice,
      target,
      actualForces,
    })
  })
})
