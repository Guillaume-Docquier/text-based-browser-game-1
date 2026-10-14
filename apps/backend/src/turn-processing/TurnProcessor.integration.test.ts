import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  createThreeOwnerStationedAssaultFixture,
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  mulberry32FirstDraw,
  mulberry32DrawSequence,
  normalizedOutcomeSequence,
  outcomeForOwner,
  ownerFleetForces,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
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
      const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
      const clients = [alice, bob] as const
      const playerAId = branded<PlayerId>(alice.account.id)
      const playerBId = branded<PlayerId>(bob.account.id)
      const playerIds = [playerAId, playerBId] as const
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: AssaultWorkerRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 147,
        }),
      })
      await bob.client.games.join.mutate({ gameId })
      await alice.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
      Assert.isDefined(target)
      const homeA = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerAId)
      const homeB = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerBId)
      Assert.isDefined(homeA)
      Assert.isDefined(homeB)

      const verifyHomesPhase1 = async (): Promise<void> => {
        const homes = [homeA, homeB] as const
        const homeDistances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))
        const assertScenarioState1 = (): void => {
          expect({
            target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
            homes: homes.map((home, index) => ({
              playerId: playerIds[index],
              id: home.id,
              name: home.name,
              coordinates: home.coordinates,
              x: home.x,
              y: home.y,
              distance: homeDistances[index],
            })),
          }).toStrictEqual({
            target: {
              id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
              name: "planet 552840",
              coordinates: "45:83:40",
              x: 53.24122006799319,
              y: 48.68601626316641,
            },
            homes: [
              {
                playerId: "00000000-0000-4000-8000-000000000001",
                id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
                name: "planet 552840",
                coordinates: "45:83:40",
                x: 53.24122006799319,
                y: 48.68601626316641,
                distance: 0,
              },
              {
                playerId: "00000000-0000-4000-8000-000000000002",
                id: "ec56a9af-3995-521c-822d-84685a96fdc6",
                name: "planet 819299",
                coordinates: "44:98:05",
                x: 48.987456457561635,
                y: 49.880579392930315,
                distance: 4.418312565270031,
              },
            ],
          })
        }
        assertScenarioState1()

        // Arrange: produce A30/B20 only through public Build submissions and actual worker turns.
        for (let buildRound = 0; buildRound < 3; buildRound += 1) {
          const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
          for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
            const buildCount = ownerIndex === 0 ? 3 : 2
            if (buildRound < buildCount) {
              const client = clients[ownerIndex]
              const view = views[ownerIndex]
              const home = homes[ownerIndex]
              Assert.isDefined(client)
              Assert.isDefined(view)
              Assert.isDefined(home)
              await client.client.gameplay.updateActionSubmission.mutate({
                gameId,
                turn: view.turn,
                submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
              })
            }
          }
          const view = views[0]
          Assert.isDefined(view)
          await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
        }
      }
      await verifyHomesPhase1()

      const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const builtFleetA = builtView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerAId && originPlanetId === homeA.id && movement === undefined,
      )
      const builtFleetB = builtView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerBId && originPlanetId === homeB.id && movement === undefined,
      )
      Assert.isDefined(builtFleetA)
      Assert.isDefined(builtFleetB)
      const builtFleets = [builtFleetA, builtFleetB] as const
      expect(builtFleets.map(({ strength }) => strength)).toStrictEqual([30, 20])
      const targetOwnerIndex = target.id === homeA.id ? 0 : target.id === homeB.id ? 1 : -1
      expect(targetOwnerIndex).toBeGreaterThanOrEqual(0)
      const movingClient = targetOwnerIndex === 0 ? bob : alice
      const movingFleet = targetOwnerIndex === 0 ? builtFleetB : builtFleetA

      // Act: move the non-target owner's complete fleet to the fixed target through a public ordinary Move order.
      await movingClient.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetExceptional.id,
          { fleet: movingFleet.id, planet: target.id },
          { strength: movingFleet.strength },
        ),
      })
      await processPublicTurn({ clients, gameId, turn: builtView.turn, turnProcessor })
      const stationedView = await alice.client.gameplay.getPlayerView.query({ gameId })
      const stationedA = stationedView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerAId && originPlanetId === target.id && movement === undefined,
      )
      const stationedB = stationedView.fleets.find(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          ownerPlayerId === playerBId && originPlanetId === target.id && movement === undefined,
      )
      Assert.isDefined(stationedA)
      Assert.isDefined(stationedB)
      const stationed = [stationedA, stationedB] as const
      expect(stationed.map(({ strength }) => strength)).toStrictEqual([30, 20])

      // Act: both owners submit the same pooled stationary Assault instance, then publicly close the turn.
      const preAssaultViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
      const actionIds: string[] = []
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
      expect(actionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
      const assaultTurn = preAssaultViews[0]
      Assert.isDefined(assaultTurn)
      await Promise.all(
        clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: assaultTurn.turn, isReady: true })),
      )

      // Act: capture the production-parsed turn inside a transaction that must roll back every processing mutation.
      const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: assaultTurn.turn })

      // Assert: the shared replay independently predicts the canonical shuffled order and full per-owner outcome sequence.
      expect(observed.submittedActions).toHaveLength(2)
      expect(observed.submittedActions.map(({ id }) => id)).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
      expect(
        Object.values(observed.fleets)
          .filter(({ ownerPlayerId, originPlanetId }) => playerIds.includes(ownerPlayerId) && originPlanetId === target.id)
          .map(({ strength }) => strength)
          .toSorted((first, second) => second - first),
      ).toStrictEqual([30, 20])
      const draw = mulberry32FirstDraw(observed.rngState.generatorState)
      const forward = replayObservedTurn(observed, false)
      const permuted = replayObservedTurn(observed, true)
      expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
      expect(forward.rngState).toStrictEqual(permuted.rngState)
      expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
        permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
      )
      expect(
        Object.values(forward.resolved.fleets)
          .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
          .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
      ).toStrictEqual(
        Object.values(permuted.resolved.fleets)
          .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
          .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
      )
      const outcomeA = outcomeForOwner(forward.resolved, playerIds[0])
      const outcomeB = outcomeForOwner(forward.resolved, playerIds[1])
      Assert.isDefined(outcomeA)
      Assert.isDefined(outcomeB)

      const verifyOutcomeBPhase2Value1 = draw.value
      const verifyOutcomeBPhase2Observed = observed
      const verifyOutcomeBPhase2 = async (): Promise<void> => {
        if (verifyOutcomeBPhase2Value1 < 0.5) {
          expect(outcomeB).toStrictEqual({
            type: "RESOLVED",
            result: `Fleet "${stationed[1].name}" exchanged 20 Strength with 30 enemy Strength at Planet "${target.name}"`,
          })
          expect(outcomeA).toStrictEqual({
            type: "RESOLVED",
            result: `Fleet "${stationed[0].name}" found no enemy Fleets at Planet "${target.name}"`,
          })
        } else {
          expect(outcomeA).toStrictEqual({
            type: "RESOLVED",
            result: `Fleet "${stationed[0].name}" exchanged 20 Strength with 20 enemy Strength at Planet "${target.name}"`,
          })
          expect(outcomeB).toStrictEqual({
            type: "PREVENTED",
            reason: `Attacking Fleet "${stationed[1].id}" was destroyed before its Assault`,
          })
        }
        expect(forward.rngState).toStrictEqual({
          generatorState: draw.nextGeneratorState,
          spareNormal: verifyOutcomeBPhase2Observed.rngState.spareNormal,
        })
        // Assert: the actual worker independently reloads/saves the same tie and public views show its force result.
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await verifyOutcomeBPhase2()

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

      const verifyEmptyObservedPhase3Value1 = draw.value
      const verifyEmptyObservedPhase3Observed = observed
      const verifyEmptyObservedPhase3 = async (): Promise<void> => {
        await processPublicTurn({ clients, gameId, turn: emptyTurn.turn, turnProcessor, process: false })
        const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
        expect(emptyObserved.submittedActions).toStrictEqual([])
        expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
        logWorkerObservation(
          "[I2-06 natural two-owner worker observation]",
          JSON.stringify({
            initialRngState: verifyEmptyObservedPhase3Observed.rngState,
            draws: [{ value: verifyEmptyObservedPhase3Value1, nextGeneratorState: draw.nextGeneratorState }],
            names: [],
            canonicalKeys: stationed.map((fleet, index) => playerIds[index] + "/" + actionIds[index] + "/" + fleet.id),
            selectedTieOrder: verifyEmptyObservedPhase3Value1 < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
            replayNextState: forward.rngState,
            workerNextState: emptyObserved.rngState,
          }),
        )
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        const afterEmptyViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
        expect(
          afterEmptyViews[0]?.fleets
            .map(({ id, strength, originPlanetId }) => ({ id, strength, originPlanetId }))
            .toSorted((a, b) => compareOrdinalStrings(a.id, b.id)),
        ).toStrictEqual(
          afterCombatViews[0]?.fleets
            .map(({ id, strength, originPlanetId }) => ({ id, strength, originPlanetId }))
            .toSorted((a, b) => compareOrdinalStrings(a.id, b.id)),
        )
        for (const view of afterEmptyViews) {
          expect(view.actions.find(({ id }) => id === actionIds[0])).toMatchObject({ selectedTargets: null, isInProgress: false })
        }
      }
      await verifyEmptyObservedPhase3()
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
    expect(assaultActionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
    const assaultTurn = preAssaultViews[0]
    Assert.isDefined(assaultTurn)
    await Promise.all(
      clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: assaultTurn.turn, isReady: true })),
    )

    // Act: observe the parsed production input with an intentional transaction rollback; no gameplay setup uses SQL.
    const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: assaultTurn.turn })

    // Assert: replay the independent captured input in both row orders and check the literal branch selected by Mulberry32.
    expect(observed.submittedActions).toHaveLength(5)
    const observedBuildActions = observed.submittedActions.filter(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    expect(
      observedBuildActions
        .map(({ id, playerId }) => ({ id, playerId }))
        .toSorted((left, right) => compareOrdinalStrings(left.playerId, right.playerId)),
    ).toStrictEqual(playerIds.map((playerId) => ({ id: "BUILD_FLEET_STANDARD_1", playerId })))
    expect(
      observed.submittedActions.filter(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id).map(({ id }) => id),
    ).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
    const rngSequence = mulberry32DrawSequence(observed.rngState.generatorState, 4)
    expect(rngSequence.draws).toHaveLength(4)
    const draw = rngSequence.draws[3]
    Assert.isDefined(draw)
    const forward = replayObservedTurn(observed, false)
    const permuted = replayObservedTurn(observed, true)
    expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
    expect(forward.rngState).toStrictEqual(permuted.rngState)
    expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
      permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
    )
    expect(
      Object.values(forward.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
    ).toStrictEqual(
      Object.values(permuted.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
    )
    expect(forward.rngState.generatorState).toBe(rngSequence.finalGeneratorState)
    const expectedBuildNames = rngSequence.draws.slice(0, 3).map(({ value }) => "fleet " + (999 + Math.floor(value * 999001)))
    expect(expectedBuildNames).toHaveLength(3)
    const replayBuilds: Array<{
      id: string
      name: string
      ownerPlayerId: PlayerId
      originPlanetId: string
      strength: number
    }> = []

    const verifyOwnerIndexPhase4 = (): void => {
      for (let ownerIndex = 0; ownerIndex < playerIds.length; ownerIndex += 1) {
        const ownerPlayerId = playerIds[ownerIndex]
        const home = homes[ownerIndex]
        const expectedName = expectedBuildNames[ownerIndex]
        Assert.isDefined(ownerPlayerId)
        Assert.isDefined(home)
        Assert.isDefined(expectedName)
        const builtFleet = Object.values(forward.resolved.fleets).find(
          ({ ownerPlayerId: fleetOwner, originPlanetId }) => fleetOwner === ownerPlayerId && originPlanetId === home.id,
        )
        Assert.isDefined(builtFleet)
        expect(builtFleet).toMatchObject({
          name: expectedName,
          ownerPlayerId,
          originPlanetId: home.id,
          strength: 10,
        })
        replayBuilds.push({
          id: builtFleet.id,
          name: builtFleet.name,
          ownerPlayerId,
          originPlanetId: home.id,
          strength: builtFleet.strength,
        })
      }
      const assertScenarioState1 = (): void => {
        expect(
          Object.values(forward.resolved.fleets)
            .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({
              id,
              name,
              ownerPlayerId,
              originPlanetId,
              strength,
            }))
            .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
        ).toStrictEqual(
          Object.values(permuted.resolved.fleets)
            .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({
              id,
              name,
              ownerPlayerId,
              originPlanetId,
              strength,
            }))
            .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
        )
      }
      assertScenarioState1()
    }
    verifyOwnerIndexPhase4()

    const assaultActionIdA = assaultActionIds[0]
    const assaultActionIdB = assaultActionIds[1]
    Assert.isDefined(assaultActionIdA)
    Assert.isDefined(assaultActionIdB)
    const outcomeA = outcomeForOwner(forward.resolved, playerIds[0], assaultActionIdA)
    const outcomeB = outcomeForOwner(forward.resolved, playerIds[1], assaultActionIdB)
    Assert.isDefined(outcomeA)
    Assert.isDefined(outcomeB)
    const fleetA = stationed[0]
    const fleetB = stationed[1]
    const fleetC = stationed[2]
    Assert.isDefined(fleetA)
    Assert.isDefined(fleetB)
    Assert.isDefined(fleetC)

    const verifyOutcomeBPhase5Value1 = draw.value
    const verifyOutcomeBPhase5Observed = observed
    const verifyOutcomeBPhase5 = async (): Promise<void> => {
      if (verifyOutcomeBPhase5Value1 < 0.5) {
        expect(outcomeB).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetB.name}" exchanged 20 Strength with 40 enemy Strength at Planet "${target.name}"`,
        })
        expect(outcomeA).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetA.name}" exchanged 5 Strength with 5 enemy Strength at Planet "${target.name}"`,
        })
        expect(ownerFleetForces(forward.resolved, playerIds, target.id)).toStrictEqual({
          [playerAId]: [10],
          [playerBId]: [],
          [playerCId]: [],
        })
        expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
          [fleetB.id, fleetC.id].toSorted(compareOrdinalStrings),
        )
      } else {
        expect(outcomeA).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetA.name}" exchanged 30 Strength with 30 enemy Strength at Planet "${target.name}"`,
        })
        expect(outcomeB).toStrictEqual({
          type: "PREVENTED",
          reason: `Attacking Fleet "${fleetB.id}" was destroyed before its Assault`,
        })
        expect(ownerFleetForces(forward.resolved, playerIds, target.id)).toStrictEqual({
          [playerAId]: [],
          [playerBId]: [],
          [playerCId]: [],
        })
        expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
          [fleetA.id, fleetB.id, fleetC.id].toSorted(compareOrdinalStrings),
        )
      }
      expect(forward.rngState).toStrictEqual({
        generatorState: draw.nextGeneratorState,
        spareNormal: verifyOutcomeBPhase5Observed.rngState.spareNormal,
      })
      // Assert: the actual worker independently reloads/resolves/saves the tied orders; public forces prove the branch.
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    }
    await verifyOutcomeBPhase5()

    const afterCombatViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const actualForces = Object.fromEntries(
      playerIds.map((playerId) => [
        playerId,
        afterCombatViews[0]?.fleets
          .filter(({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && originPlanetId === target.id)
          .map(({ strength }) => strength)
          .toSorted((first, second) => first - second),
      ]),
    )
    expect(actualForces).toStrictEqual(ownerFleetForces(forward.resolved, playerIds, target.id))
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

    const verifyEmptyObservedPhase6Value1 = draw.value
    const verifyEmptyObservedPhase6Observed = observed
    const verifyEmptyObservedPhase6 = async (): Promise<void> => {
      await Promise.all(
        clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: emptyTurn.turn, isReady: true })),
      )
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
      logWorkerObservation(
        "[I2-14 natural three-owner Build plus Assault worker observation]",
        JSON.stringify({
          initialRngState: verifyEmptyObservedPhase6Observed.rngState,
          draws: rngSequence.draws,
          names: actualWorkerBuildNames,
          derivedBuildNames: expectedBuildNames,
          canonicalBuildKeys: playerIds.map((playerId, index) => playerId + "/" + buildActionIds[index] + "/" + homes[index]?.id),
          canonicalAssaultKeys: stationed
            .slice(0, 2)
            .map((fleet, index) => playerIds[index] + "/" + assaultActionIds[index] + "/" + fleet.id),
          selectedTieOrder: verifyEmptyObservedPhase6Value1 < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
          replayNextState: forward.rngState,
          workerNextState: emptyObserved.rngState,
        }),
      )
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(ownerPublicForces(afterEmpty.fleets, playerIds, target.id)).toStrictEqual(actualForces)
    }
    await verifyEmptyObservedPhase6()
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
    expect(assaultActionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
    const assaultTurn = preAssaultViews[0]
    Assert.isDefined(assaultTurn)
    await Promise.all(
      clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: assaultTurn.turn, isReady: true })),
    )

    // Act: observe the parsed production input with an intentional transaction rollback; no gameplay setup uses SQL.
    const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: assaultTurn.turn })

    // Assert: replay the independent captured input in both row orders and check the literal branch selected by Mulberry32.
    expect(observed.submittedActions).toHaveLength(2)
    expect(observed.submittedActions.map(({ id }) => id)).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
    const draw = mulberry32FirstDraw(observed.rngState.generatorState)
    const forward = replayObservedTurn(observed, false)
    const permuted = replayObservedTurn(observed, true)
    expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
    expect(forward.rngState).toStrictEqual(permuted.rngState)
    expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
      permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
    )
    expect(
      Object.values(forward.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
    ).toStrictEqual(
      Object.values(permuted.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
    )
    const assaultActionIdA = assaultActionIds[0]
    const assaultActionIdB = assaultActionIds[1]
    Assert.isDefined(assaultActionIdA)
    Assert.isDefined(assaultActionIdB)
    const outcomeA = outcomeForOwner(forward.resolved, playerIds[0], assaultActionIdA)
    const outcomeB = outcomeForOwner(forward.resolved, playerIds[1], assaultActionIdB)
    Assert.isDefined(outcomeA)
    Assert.isDefined(outcomeB)
    const fleetA = stationed[0]
    const fleetB = stationed[1]
    const fleetC = stationed[2]
    Assert.isDefined(fleetA)
    Assert.isDefined(fleetB)
    Assert.isDefined(fleetC)

    const verifyOutcomeBPhase7Value1 = draw.value
    const verifyOutcomeBPhase7Observed = observed
    const verifyOutcomeBPhase7 = async (): Promise<void> => {
      if (verifyOutcomeBPhase7Value1 < 0.5) {
        expect(outcomeB).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetB.name}" exchanged 20 Strength with 40 enemy Strength at Planet "${target.name}"`,
        })
        expect(outcomeA).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetA.name}" exchanged 5 Strength with 5 enemy Strength at Planet "${target.name}"`,
        })
        expect(ownerFleetForces(forward.resolved, playerIds, target.id)).toStrictEqual({
          [playerAId]: [10],
          [playerBId]: [],
          [playerCId]: [],
        })
        expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
          [fleetB.id, fleetC.id].toSorted(compareOrdinalStrings),
        )
      } else {
        expect(outcomeA).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${fleetA.name}" exchanged 30 Strength with 30 enemy Strength at Planet "${target.name}"`,
        })
        expect(outcomeB).toStrictEqual({
          type: "PREVENTED",
          reason: `Attacking Fleet "${fleetB.id}" was destroyed before its Assault`,
        })
        expect(ownerFleetForces(forward.resolved, playerIds, target.id)).toStrictEqual({
          [playerAId]: [],
          [playerBId]: [],
          [playerCId]: [],
        })
        expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
          [fleetA.id, fleetB.id, fleetC.id].toSorted(compareOrdinalStrings),
        )
      }
      expect(forward.rngState).toStrictEqual({
        generatorState: draw.nextGeneratorState,
        spareNormal: verifyOutcomeBPhase7Observed.rngState.spareNormal,
      })
      // Assert: the actual worker independently reloads/resolves/saves the tied orders; public forces prove the branch.
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    }
    await verifyOutcomeBPhase7()

    const afterCombatViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const actualForces = Object.fromEntries(
      playerIds.map((playerId) => [
        playerId,
        afterCombatViews[0]?.fleets
          .filter(({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && originPlanetId === target.id)
          .map(({ strength }) => strength)
          .toSorted((first, second) => first - second),
      ]),
    )
    expect(actualForces).toStrictEqual(ownerFleetForces(forward.resolved, playerIds, target.id))
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

    const verifyEmptyObservedPhase8Value1 = draw.value
    const verifyEmptyObservedPhase8Observed = observed
    const verifyEmptyObservedPhase8 = async (): Promise<void> => {
      await Promise.all(
        clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: emptyTurn.turn, isReady: true })),
      )
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
      logWorkerObservation(
        "[I2-06 natural three-owner Assault-only worker observation]",
        JSON.stringify({
          initialRngState: verifyEmptyObservedPhase8Observed.rngState,
          draws: [{ value: verifyEmptyObservedPhase8Value1, nextGeneratorState: draw.nextGeneratorState }],
          names: [],
          canonicalAssaultKeys: stationed
            .slice(0, 2)
            .map((fleet, index) => playerIds[index] + "/" + assaultActionIds[index] + "/" + fleet.id),
          selectedTieOrder: verifyEmptyObservedPhase8Value1 < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
          replayNextState: forward.rngState,
          workerNextState: emptyObserved.rngState,
        }),
      )
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(ownerPublicForces(afterEmpty.fleets, playerIds, target.id)).toStrictEqual(actualForces)
    }
    await verifyEmptyObservedPhase8()
  })
})
