import {
  Assert,
  branded,
  Datetime,
  indexBy,
  Logger,
  mulberry32Prng,
  type DeepUnbranded,
  Result,
  Rng,
  type RngState,
  Time,
  UnitOfTime,
} from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { asc, eq } from "drizzle-orm"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import {
  BuildFleetExceptional,
  BuildFleetImproved,
  BuildFleetStandard,
} from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { GainEnergy } from "shared/testing/test-ruleset/action-definitions/gain-energy.ts"
import { GainFuel } from "shared/testing/test-ruleset/action-definitions/gain-fuel.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { WinTheGame } from "shared/testing/test-ruleset/action-definitions/win-the-game.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { v5 } from "uuid"
import { afterEach, describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
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
import { ApiServer } from "#tests/ApiServer.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, type TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"

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
      const homes = [homeA, homeB] as const
      const homeDistances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))
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
      if (draw.value < 0.5) {
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
        spareNormal: observed.rngState.spareNormal,
      })
      // Assert: the actual worker independently reloads/saves the same tie and public views show its force result.
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
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
      await processPublicTurn({ clients, gameId, turn: emptyTurn.turn, turnProcessor, process: false })
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
      logWorkerObservation(
        "[I2-06 natural two-owner worker observation]",
        JSON.stringify({
          initialRngState: observed.rngState,
          draws: [{ value: draw.value, nextGeneratorState: draw.nextGeneratorState }],
          names: [],
          canonicalKeys: stationed.map((fleet, index) => playerIds[index] + "/" + actionIds[index] + "/" + fleet.id),
          selectedTieOrder: draw.value < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
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
    if (draw.value < 0.5) {
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
      spareNormal: observed.rngState.spareNormal,
    })
    // Assert: the actual worker independently reloads/resolves/saves the tied orders; public forces prove the branch.
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
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
    await Promise.all(
      clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: emptyTurn.turn, isReady: true })),
    )
    const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
    expect(emptyObserved.submittedActions).toStrictEqual([])
    expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
    logWorkerObservation(
      "[I2-14 natural three-owner Build plus Assault worker observation]",
      JSON.stringify({
        initialRngState: observed.rngState,
        draws: rngSequence.draws,
        names: actualWorkerBuildNames,
        derivedBuildNames: expectedBuildNames,
        canonicalBuildKeys: playerIds.map((playerId, index) => playerId + "/" + buildActionIds[index] + "/" + homes[index]?.id),
        canonicalAssaultKeys: stationed
          .slice(0, 2)
          .map((fleet, index) => playerIds[index] + "/" + assaultActionIds[index] + "/" + fleet.id),
        selectedTieOrder: draw.value < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
        replayNextState: forward.rngState,
        workerNextState: emptyObserved.rngState,
      }),
    )
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(ownerPublicForces(afterEmpty.fleets, playerIds, target.id)).toStrictEqual(actualForces)
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
    if (draw.value < 0.5) {
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
      spareNormal: observed.rngState.spareNormal,
    })
    // Assert: the actual worker independently reloads/resolves/saves the tied orders; public forces prove the branch.
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
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
    await Promise.all(
      clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn: emptyTurn.turn, isReady: true })),
    )
    const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn.turn })
    expect(emptyObserved.submittedActions).toStrictEqual([])
    expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
    logWorkerObservation(
      "[I2-06 natural three-owner Assault-only worker observation]",
      JSON.stringify({
        initialRngState: observed.rngState,
        draws: [{ value: draw.value, nextGeneratorState: draw.nextGeneratorState }],
        names: [],
        canonicalAssaultKeys: stationed
          .slice(0, 2)
          .map((fleet, index) => playerIds[index] + "/" + assaultActionIds[index] + "/" + fleet.id),
        selectedTieOrder: draw.value < 0.5 ? [playerIds[1], playerIds[0]] : [playerIds[0], playerIds[1]],
        replayNextState: forward.rngState,
        workerNextState: emptyObserved.rngState,
      }),
    )
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(ownerPublicForces(afterEmpty.fleets, playerIds, target.id)).toStrictEqual(actualForces)
  })
  integrationTest(
    "should preserve literal public worker Assault arithmetic and FleetId remainder ties",
    { timeout: 90_000 },
    async ({ db }) => {
      // Arrange: use genuine public game setup and actual worker turns for each independent combat vector.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
      const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
      const carol = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" })
      const availableClients = [alice, bob, carol] as const
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      const cases: Array<{
        forces: readonly number[]
        expectedStrengths: readonly number[] | undefined
        enemyTotal: number
        exchangeStrength: number
        fleetIdRemainderTie?: boolean
      }> = [
        { forces: [30, 20], expectedStrengths: [10, 0], enemyTotal: 20, exchangeStrength: 20 },
        { forces: [20, 30], expectedStrengths: [0, 10], enemyTotal: 30, exchangeStrength: 20 },
        { forces: [20, 20], expectedStrengths: [0, 0], enemyTotal: 20, exchangeStrength: 20 },
        { forces: [20, 10, 20], expectedStrengths: [0, 3, 7], enemyTotal: 30, exchangeStrength: 20 },
        { forces: [30, 10, 20], expectedStrengths: [0, 0, 0], enemyTotal: 30, exchangeStrength: 30 },
        { forces: [1, 1, 1], expectedStrengths: undefined, enemyTotal: 2, exchangeStrength: 1, fleetIdRemainderTie: true },
      ] as const

      for (const scenario of cases) {
        const fixture = await createPublicAssaultStagingFixture({
          apiServer,
          clients: availableClients,
          forces: scenario.forces,
          stagingCoordinates: "45:83:40",
          targetOwnerFirst: scenario.forces.length === 2,
          turnProcessor,
          expectedRouteDistances:
            scenario.forces.length === 2 ? [0, 4.418312565270031] : [6.340414101122655, 12.182152625782757, 8.039286685075407],
        })
        expect(fixture.stagingPlanet).toMatchObject({
          id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
          name: "planet 552840",
          coordinates: "45:83:40",
          x: 53.24122006799319,
          y: 48.68601626316641,
        })
        expect(fixture.homes.map(({ coordinates }) => coordinates)).toStrictEqual(
          scenario.forces.length === 2 ? ["45:83:40", "44:98:05"] : ["54:28:25", "46:95:40", "44:36:25"],
        )
        if (scenario.forces.length === 3) {
          expect(fixture.stagingPlanet.ownerPlayerId === null || fixture.stagingPlanet.ownerPlayerId === undefined).toBe(true)
        } else {
          expect(fixture.stagingPlanet.ownerPlayerId).toBe(fixture.playerIds[0])
        }
        expect(fixture.stationed.map(({ strength }) => strength)).toStrictEqual([...scenario.forces])

        // Act: submit one stationary Assault from role A and capture the production-parsed input without committing it.
        const beforeViews = await Promise.all(
          fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
        )
        const attackerView = beforeViews[0]
        const attackerFleet = fixture.stationed[0]
        Assert.isDefined(attackerView)
        Assert.isDefined(attackerFleet)
        const assaultAction = attackerView.actions.find(
          ({ actionDefinitionId }) => actionDefinitionId === ChargedStationaryAssaultWorkerTest.id,
        )
        Assert.isDefined(assaultAction)
        const attackerClient = fixture.clients[0]
        Assert.isDefined(attackerClient)
        await attackerClient.client.gameplay.updateActionSubmission.mutate({
          gameId: fixture.gameId,
          turn: attackerView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(attackerView, ChargedStationaryAssaultWorkerTest.id, {
            station: attackerFleet.id,
            battlePlanet: fixture.stagingPlanet.id,
          }),
        })
        await processPublicTurn({
          clients: fixture.clients,
          gameId: fixture.gameId,
          turn: attackerView.turn,
          turnProcessor,
          process: false,
        })
        const observed = await observeTurnAndRollback({
          db,
          clock,
          turnsRepository,
          gameId: fixture.gameId,
          turn: attackerView.turn,
        })
        const forward = replayObservedTurn(observed, false)
        const permuted = replayObservedTurn(observed, true)

        // Assert: a literal single exchange uses all enemy owners and allocates integer losses by largest remainder.
        expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
        expect(forward.rngState).toStrictEqual(observed.rngState)
        expect(permuted.rngState).toStrictEqual(observed.rngState)
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
        const attackerOutcome = outcomeForOwner(forward.resolved, fixture.playerIds[0], assaultAction.id)
        Assert.isDefined(attackerOutcome)
        expect(attackerOutcome).toStrictEqual({
          type: "RESOLVED",
          result: `Fleet "${attackerFleet.name}" exchanged ${scenario.exchangeStrength} Strength with ${scenario.enemyTotal} enemy Strength at Planet "${fixture.stagingPlanet.name}"`,
        })
        let expectedStrengths = scenario.expectedStrengths
        if (scenario.fleetIdRemainderTie === true) {
          const defenderB = fixture.stationed[1]
          const defenderC = fixture.stationed[2]
          Assert.isDefined(defenderB)
          Assert.isDefined(defenderC)
          const lowerFleetId = defenderB.id < defenderC.id ? defenderB.id : defenderC.id
          expectedStrengths = [0, defenderB.id === lowerFleetId ? 0 : 1, defenderC.id === lowerFleetId ? 0 : 1]
        }
        Assert.isDefined(expectedStrengths)
        const expectedForces = Object.fromEntries(
          fixture.playerIds.map((playerId, index) => {
            const strength = expectedStrengths[index]
            Assert.isDefined(strength)
            return [playerId, strength === 0 ? [] : [strength]]
          }),
        )
        expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.stagingPlanet.id)).toStrictEqual(expectedForces)
        expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.stagingPlanet.id)).toStrictEqual(expectedForces)
        const beforeAttackerResources = beforeViews[0]
        Assert.isDefined(beforeAttackerResources)
        const resolvedAttackerAction = forward.resolved.resolvedActions.find(
          ({ submittedAction }) => submittedAction.playerId === fixture.playerIds[0] && submittedAction.id === assaultAction.id,
        )
        Assert.isDefined(resolvedAttackerAction)
        expect(resolvedAttackerAction.actionOutcomes).toHaveLength(3)

        // Act: independently run the production worker and read refreshed public fleet/resource/action state.
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        const afterViews = await Promise.all(
          fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
        )
        const after = afterViews[0]
        Assert.isDefined(after)

        // Assert: persisted forces, survivor identities, unchanged ownership/resources and released Assault instance match literals.
        expect(ownerPublicForces(after.fleets, fixture.playerIds, fixture.stagingPlanet.id)).toStrictEqual(expectedForces)
        for (let roleIndex = 0; roleIndex < fixture.stationed.length; roleIndex += 1) {
          const stagedFleet = fixture.stationed[roleIndex]
          const expectedStrength: number | undefined = expectedStrengths[roleIndex]
          Assert.isDefined(stagedFleet)
          Assert.isDefined(expectedStrength)
          const actual: PlayerView["fleets"][number] | undefined = after.fleets.find(({ id }) => id === stagedFleet.id)
          if (expectedStrength > 0) {
            Assert.isDefined(actual)
            expect(actual).toMatchObject({ id: stagedFleet.id, name: stagedFleet.name, strength: expectedStrength })
          } else {
            expect(actual).toBeUndefined()
          }
        }
        for (let ownerIndex = 0; ownerIndex < fixture.clients.length; ownerIndex += 1) {
          const before = beforeViews[ownerIndex]
          const afterOwner = afterViews[ownerIndex]
          Assert.isDefined(before)
          Assert.isDefined(afterOwner)
          expect(
            afterOwner.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === fixture.stagingPlanet.id)?.ownerPlayerId,
          ).toBe(before.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === fixture.stagingPlanet.id)?.ownerPlayerId)
          for (const resourceType of Object.values(ResourceType)) {
            const spent = resourceType === ResourceType.INFLUENCE ? 5 : resourceType === ResourceType.FUEL ? 1 : 0
            const expectedTotal = before.resources[resourceType].total - (ownerIndex === 0 ? spent : 0)
            expect(afterOwner.resources[resourceType].total).toBe(expectedTotal)
          }
        }
        expect(after.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })

        // Assert: the next public empty turn exposes the RNG state saved by the real Assault worker.
        await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: after.turn, turnProcessor, process: false })
        const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: after.turn })
        expect(emptyObserved.submittedActions).toStrictEqual([])
        expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
        logWorkerObservation(
          "[I2-01/I2-02 public arithmetic worker RNG persistence]",
          JSON.stringify({
            forces: scenario.forces,
            workerNextState: emptyObserved.rngState,
            replayNextState: forward.rngState,
          }),
        )
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(
          afterEmpty.fleets
            .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
            .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
        ).toStrictEqual(
          after.fleets
            .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
            .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
        )
      }
    },
  )
  integrationTest(
    "should persist tick-five and tick-fifteen Assault chronology across public worker turns",
    { timeout: 120_000 },
    async ({ db }) => {
      // Arrange: create a genuine two-owner seed-147 game and stage both fleets at the named public planet.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const clients = [
        await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" }),
        await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" }),
      ] as const
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const fixture = await createPublicAssaultStagingFixture({
        apiServer,
        clients,
        forces: [30, 20],
        stagingCoordinates: "44:98:05",
        targetOwnerFirst: true,
        turnProcessor,
        expectedRouteDistances: [0, 4.418312565270031],
      })
      const initialView = await fixture.clients[0]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const target = initialView?.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "45:83:40")
      Assert.isDefined(target)
      expect({
        source: [fixture.stagingPlanet.id, fixture.stagingPlanet.coordinates, fixture.stagingPlanet.x, fixture.stagingPlanet.y],
        target: [target.id, target.coordinates, target.x, target.y],
        distance: Math.hypot(target.x - fixture.stagingPlanet.x, target.y - fixture.stagingPlanet.y),
      }).toStrictEqual({
        source: ["ec56a9af-3995-521c-822d-84685a96fdc6", "44:98:05", 48.987456457561635, 49.880579392930315],
        target: ["57c1b320-c267-5c9b-a5a5-1b5a02823714", "45:83:40", 53.24122006799319, 48.68601626316641],
        distance: 4.418312565270031,
      })

      // Act: submit two distinct tick-priority Attack Moves and capture the production-parsed input for replay.
      const beforeViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      const definitions = [TickFiveAttackMoveWorkerTest, TickFifteenAttackMoveWorkerTest] as const
      const forces = [30, 20] as const
      const actionIds: string[] = []
      for (let index = 0; index < 2; index += 1) {
        const client = fixture.clients[index]
        const view = beforeViews[index]
        const fleet = fixture.stationed[index]
        const definition = definitions[index]
        const force = forces[index]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(fleet)
        Assert.isDefined(definition)
        Assert.isDefined(force)
        const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === definition.id)
        Assert.isDefined(action)
        actionIds.push(action.id)
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: fixture.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(
            view,
            definition.id,
            { fleet: fleet.id, planet: target.id },
            { strength: force },
          ),
        })
      }
      const currentTurn = beforeViews[0]
      Assert.isDefined(currentTurn)
      await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: currentTurn.turn, turnProcessor, process: false })
      const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: currentTurn.turn })
      const forward = replayObservedTurn(observed, false)
      const permuted = replayObservedTurn(observed, true)

      // Assert: A30 wins its tick-5 exchange, then the already destroyed B20 order completes Prevented at tick15.
      expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
      expect(forward.rngState).toStrictEqual(observed.rngState)
      expect(permuted.rngState).toStrictEqual(observed.rngState)
      const firstFleet = fixture.stationed[0]
      const laterFleet = fixture.stationed[1]
      const playerAId = fixture.playerIds[0]
      const playerBId = fixture.playerIds[1]
      const firstActionId = actionIds[0]
      const laterActionId = actionIds[1]
      Assert.isDefined(playerAId)
      Assert.isDefined(playerBId)
      Assert.isDefined(firstActionId)
      Assert.isDefined(laterActionId)
      const firstOutcome = outcomeForOwner(forward.resolved, playerAId, actionIds[0])
      const laterOutcome = outcomeForOwner(forward.resolved, playerBId, actionIds[1])
      Assert.isDefined(firstFleet)
      Assert.isDefined(laterFleet)
      const firstJourneyId = v5(
        JSON.stringify([fixture.gameId, playerAId, currentTurn.turn, firstActionId, firstFleet.id]),
        "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
      )
      const laterJourneyId = v5(
        JSON.stringify([fixture.gameId, playerBId, currentTurn.turn, laterActionId, laterFleet.id]),
        "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
      )
      expect(firstOutcome).toStrictEqual({
        type: "RESOLVED",
        result: 'Fleet "' + firstFleet.name + '" exchanged 20 Strength with 20 enemy Strength at Planet "' + target.name + '"',
      })
      expect(laterOutcome).toStrictEqual({
        type: "PREVENTED",
        reason: `Attacking Fleet "${laterJourneyId}" was destroyed before its Assault`,
      })
      const expectedForces = { [playerAId]: [10], [playerBId]: [] }
      expect(ownerFleetForces(forward.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      expect(ownerFleetForces(permuted.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      expect(forward.resolved.removedFleetIds).toContain(laterFleet.id)
      expect(forward.resolved.removedFleetIds).toContain(laterJourneyId)

      // Act: resolve once through the actual production worker and inspect public state after save/reload.
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const afterViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )

      // Assert: persisted A10, paid costs, released pooled instances, and unchanged natural RNG survive the next empty turn.
      expect(ownerPublicForces(afterViews[0]?.fleets ?? [], fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      expect(afterViews[0]?.fleets.find(({ id }) => id === firstFleet.id)).toBeUndefined()
      expect(afterViews[0]?.fleets.find(({ id }) => id === firstJourneyId)).toMatchObject({
        id: firstJourneyId,
        name: firstFleet.name,
        ownerPlayerId: playerAId,
        strength: 10,
        originPlanetId: target.id,
      })
      expect(afterViews[0]?.fleets.find(({ id }) => id === laterFleet.id)).toBeUndefined()
      expect(afterViews[0]?.fleets.find(({ id }) => id === laterJourneyId)).toBeUndefined()
      for (let index = 0; index < 2; index += 1) {
        const before = beforeViews[index]
        const after = afterViews[index]
        const actionId = actionIds[index]
        Assert.isDefined(before)
        Assert.isDefined(after)
        Assert.isDefined(actionId)
        expect(after.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
        expect(after.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - 5)
        expect(after.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total - 1)
      }
      const emptyTurn = afterViews[0]
      Assert.isDefined(emptyTurn)
      await Promise.all(
        fixture.clients.map(
          async ({ client }) =>
            await client.gameplay.updateReadiness.mutate({
              gameId: fixture.gameId,
              turn: emptyTurn.turn,
              isReady: true,
            }),
        ),
      )
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: emptyTurn.turn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(observed.rngState)
      logWorkerObservation(
        "[I2-04 public worker]",
        JSON.stringify({
          generatorState: observed.rngState.generatorState,
          draws: [],
          ticks: [5, 15],
          order: [fixture.playerIds[0], fixture.playerIds[1]],
          nextState: emptyObserved.rngState,
        }),
      )
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    },
  )

  integrationTest(
    "should resolve public tick-five, tick-ten, and tick-fifteen arrivals before ordered Assaults",
    { timeout: 120_000 },
    async ({ db }) => {
      // Arrange: create three public owners at fixed seed147 homes and stage their literal 10/30/20 forces.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const clients = [
        await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" }),
        await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" }),
        await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" }),
      ] as const
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const fixture = await createPublicAssaultStagingFixture({
        apiServer,
        clients,
        forces: [10, 30, 20],
        stagingCoordinates: "44:98:05",
        targetOwnerFirst: false,
        turnProcessor,
        expectedRouteDistances: [2.671241249775721, 16.366911301283746, 6.3383734351009045],
      })
      expect(fixture.stagingPlanet.ownerPlayerId).toBeNull()
      const initialView = await fixture.clients[0]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const target = initialView?.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "45:83:40")
      Assert.isDefined(target)
      expect(Math.hypot(target.x - fixture.stagingPlanet.x, target.y - fixture.stagingPlanet.y)).toBe(4.418312565270031)
      expect(fixture.stationed.map(({ strength }) => strength)).toStrictEqual([10, 30, 20])

      // Act: submit each public speed once and replay the exact captured input with reversed DB/property enumeration.
      const beforeViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      const definitions = [TickFiveAttackMoveWorkerTest, TickTenAttackMoveWorkerTest, TickFifteenAttackMoveWorkerTest] as const
      const forces = [10, 30, 20] as const
      const actionIds: string[] = []
      for (let index = 0; index < 3; index += 1) {
        const client = fixture.clients[index]
        const view = beforeViews[index]
        const fleet = fixture.stationed[index]
        const definition = definitions[index]
        const force = forces[index]
        Assert.isDefined(client)
        Assert.isDefined(view)
        Assert.isDefined(fleet)
        Assert.isDefined(definition)
        Assert.isDefined(force)
        const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === definition.id)
        Assert.isDefined(action)
        actionIds.push(action.id)
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId: fixture.gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(
            view,
            definition.id,
            { fleet: fleet.id, planet: target.id },
            { strength: force },
          ),
        })
      }
      const currentTurn = beforeViews[0]
      Assert.isDefined(currentTurn)
      await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: currentTurn.turn, turnProcessor, process: false })
      const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: currentTurn.turn })
      const forward = replayObservedTurn(observed, false)
      const permuted = replayObservedTurn(observed, true)

      // Assert: A10 exchanges against all50; B24 then fights C16; C's queued order completes Prevented.
      expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
      expect(forward.rngState).toStrictEqual(observed.rngState)
      expect(permuted.rngState).toStrictEqual(observed.rngState)
      const outcomes = fixture.playerIds.map((playerId, index) => outcomeForOwner(forward.resolved, playerId, actionIds[index]))
      const fleetA = fixture.stationed[0]
      const fleetB = fixture.stationed[1]
      const fleetC = fixture.stationed[2]
      const playerAId = fixture.playerIds[0]
      const playerBId = fixture.playerIds[1]
      const playerCId = fixture.playerIds[2]
      const thirdActionId = actionIds[2]
      Assert.isDefined(outcomes[0])
      Assert.isDefined(outcomes[1])
      Assert.isDefined(outcomes[2])
      Assert.isDefined(fleetA)
      Assert.isDefined(fleetB)
      Assert.isDefined(fleetC)
      Assert.isDefined(playerCId)
      Assert.isDefined(thirdActionId)
      const thirdJourneyId = v5(
        JSON.stringify([fixture.gameId, playerCId, currentTurn.turn, thirdActionId, fleetC.id]),
        "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
      )
      const secondActionId = actionIds[1]
      Assert.isDefined(playerBId)
      Assert.isDefined(secondActionId)
      const secondJourneyId = v5(
        JSON.stringify([fixture.gameId, playerBId, currentTurn.turn, secondActionId, fleetB.id]),
        "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
      )
      expect(outcomes[0]).toStrictEqual({
        type: "RESOLVED",
        result: 'Fleet "' + fleetA.name + '" exchanged 10 Strength with 50 enemy Strength at Planet "' + target.name + '"',
      })
      expect(outcomes[1]).toStrictEqual({
        type: "RESOLVED",
        result: 'Fleet "' + fleetB.name + '" exchanged 16 Strength with 16 enemy Strength at Planet "' + target.name + '"',
      })
      expect(outcomes[2]).toStrictEqual({
        type: "PREVENTED",
        reason: `Attacking Fleet "${thirdJourneyId}" was destroyed before its Assault`,
      })
      Assert.isDefined(playerAId)
      Assert.isDefined(playerBId)
      const expectedForces = { [playerAId]: [], [playerBId]: [8], [playerCId]: [] }
      expect(ownerFleetForces(forward.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      expect(ownerFleetForces(permuted.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      expect(forward.resolved.removedFleetIds).toContain(fleetC.id)
      expect(forward.resolved.removedFleetIds).toContain(thirdJourneyId)

      // Act: the real worker independently persists final fleet rows and the next empty turn's RNG.
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const afterViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )

      // Assert: only B8 survives, all attack costs remain spent, and each Action instance is available again.
      expect(ownerPublicForces(afterViews[0]?.fleets ?? [], fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      const survivor = Object.values(forward.resolved.fleets).find(
        ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === fixture.playerIds[1] && originPlanetId === target.id,
      )
      Assert.isDefined(survivor)
      expect(survivor).toMatchObject({
        id: secondJourneyId,
        name: fleetB.name,
        ownerPlayerId: fixture.playerIds[1],
        strength: 8,
        originPlanetId: target.id,
      })
      expect(afterViews[0]?.fleets.find(({ id }) => id === fleetB.id)).toBeUndefined()
      expect(afterViews[0]?.fleets.find(({ id }) => id === survivor.id)).toMatchObject({
        id: secondJourneyId,
        name: fleetB.name,
        ownerPlayerId: fixture.playerIds[1],
        strength: 8,
        originPlanetId: target.id,
      })
      expect(afterViews[0]?.fleets.find(({ id }) => id === fleetC.id)).toBeUndefined()
      expect(afterViews[0]?.fleets.find(({ id }) => id === thirdJourneyId)).toBeUndefined()
      for (let index = 0; index < 3; index += 1) {
        const before = beforeViews[index]
        const after = afterViews[index]
        const actionId = actionIds[index]
        Assert.isDefined(before)
        Assert.isDefined(after)
        Assert.isDefined(actionId)
        expect(after.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
        expect(after.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - 5)
        expect(after.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total - 1)
      }
      const emptyTurn = afterViews[0]
      Assert.isDefined(emptyTurn)
      await Promise.all(
        fixture.clients.map(
          async ({ client }) =>
            await client.gameplay.updateReadiness.mutate({
              gameId: fixture.gameId,
              turn: emptyTurn.turn,
              isReady: true,
            }),
        ),
      )
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: emptyTurn.turn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(observed.rngState)
      logWorkerObservation(
        "[I2-05 public worker]",
        JSON.stringify({
          generatorState: observed.rngState.generatorState,
          draws: [],
          ticks: [5, 10, 15],
          outcomes: [10, 16, "Prevented"],
          nextState: emptyObserved.rngState,
        }),
      )
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    },
  )

  integrationTest("should not count an enemy transit origin as stationary presence in a public worker turn", async ({ db }) => {
    // Arrange: build two forces at the fixed shared planet through public setup and actual workers.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
    using apiServer = new ApiServer(apiServices)
    const clients = [
      await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" }),
      await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" }),
    ] as const
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    const fixture = await createPublicAssaultStagingFixture({
      apiServer,
      clients,
      forces: [30, 20],
      stagingCoordinates: "44:98:05",
      targetOwnerFirst: true,
      turnProcessor,
      expectedRouteDistances: [0, 4.418312565270031],
    })
    const beforeViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    const assaultView = beforeViews[0]
    const moveView = beforeViews[1]
    const attacker = fixture.stationed[0]
    const enemy = fixture.stationed[1]
    const attackerClient = fixture.clients[0]
    const enemyClient = fixture.clients[1]
    const enemyHome = fixture.homes[1]
    Assert.isDefined(assaultView)
    Assert.isDefined(moveView)
    Assert.isDefined(attacker)
    Assert.isDefined(enemy)
    Assert.isDefined(attackerClient)
    Assert.isDefined(enemyClient)
    Assert.isDefined(enemyHome)
    const assaultAction = assaultView.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
    const moveAction = moveView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
    Assert.isDefined(assaultAction)
    Assert.isDefined(moveAction)

    // Act: the attacker submits a stationary no-op while the enemy departs this exact planet by ordinary Move.
    await attackerClient.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: assaultView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(assaultView, StationaryAssaultTest.id, {
        station: attacker.id,
        battlePlanet: fixture.stagingPlanet.id,
      }),
    })
    await enemyClient.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: moveView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        moveView,
        MoveFleetStandard.id,
        { fleet: enemy.id, planet: enemyHome.id },
        { strength: 20 },
      ),
    })
    const currentTurn = beforeViews[0]
    Assert.isDefined(currentTurn)
    await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: currentTurn.turn, turnProcessor, process: false })
    const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: currentTurn.turn })
    const forward = replayObservedTurn(observed, false)
    const permuted = replayObservedTurn(observed, true)

    // Assert: enemy origin presence is excluded and the Assault resolves with no exchange or RNG draw.
    const playerAId = fixture.playerIds[0]
    const playerBId = fixture.playerIds[1]
    Assert.isDefined(playerAId)
    Assert.isDefined(playerBId)
    expect(outcomeForOwner(forward.resolved, playerAId, assaultAction.id)).toStrictEqual({
      type: "RESOLVED",
      result: 'Fleet "' + attacker.name + '" found no enemy Fleets at Planet "' + fixture.stagingPlanet.name + '"',
    })
    expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
    expect(
      Object.fromEntries(
        fixture.playerIds.map((playerId) => [
          playerId,
          Object.values(forward.resolved.fleets)
            .filter(
              ({ ownerPlayerId, originPlanetId, movement }) =>
                ownerPlayerId === playerId && originPlanetId === fixture.stagingPlanet.id && movement === undefined,
            )
            .map(({ strength }) => strength),
        ]),
      ),
    ).toStrictEqual({
      [playerAId]: [30],
      [playerBId]: [],
    })
    expect(forward.rngState).toStrictEqual(observed.rngState)
    expect(permuted.rngState).toStrictEqual(observed.rngState)

    // Act: the actual worker reloads, applies the departure/no-op, and saves both public rows.
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const afterViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )

    // Assert: the attacker remains30 and the departing enemy retains20 from this origin at literal remainder4.318.
    expect(afterViews[0]?.fleets.find(({ id }) => id === attacker.id)).toMatchObject({
      id: attacker.id,
      strength: 30,
      originPlanetId: fixture.stagingPlanet.id,
    })
    const expectedEnemyDepartureId = v5(
      JSON.stringify([fixture.gameId, playerBId, moveView.turn, moveAction.id, enemy.id]),
      "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
    )
    expect(afterViews[0]?.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
    expect(afterViews[0]?.fleets.find(({ id }) => id === expectedEnemyDepartureId)).toMatchObject({
      id: expectedEnemyDepartureId,
      name: enemy.name,
      strength: 20,
      originPlanetId: fixture.stagingPlanet.id,
      destinationPlanetId: enemyHome.id,
      distanceToEnd: 4.318312565270031,
      movement: { speed: 0.1 },
    })
    expect(afterViews[0]?.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(afterViews[1]?.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
  })
  integrationTest(
    "should merge two friendly arrivals and a same-turn Build before a captured Assault",
    { timeout: 120_000 },
    async ({ db }) => {
      // Arrange: Alice keeps a named7 home fleet and stages33 at Bob's home; Bob stages a defender20 at Alice's home.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
      using apiServer = new ApiServer(apiServices)
      const fixture = await createPublicHomeArrivalFixture({
        db,
        clock,
        apiServer,
        ruleset: HomeArrivalMergeRuleset,
        aliceDepartureStrength: 33,
        bobDepartureStrength: 20,
      })
      const alice = fixture.clients[0]
      const bob = fixture.clients[1]
      const playerAId = fixture.playerIds[0]
      const playerBId = fixture.playerIds[1]
      const initialFriendly = fixture.aliceAtTarget
      const attackerSource = fixture.aliceAtSource
      const enemy = fixture.bobAtTarget
      Assert.isDefined(alice)
      Assert.isDefined(bob)
      Assert.isDefined(playerAId)
      Assert.isDefined(playerBId)
      Assert.isDefined(initialFriendly)
      Assert.isDefined(attackerSource)
      Assert.isDefined(enemy)
      expect([initialFriendly.strength, attackerSource.strength, enemy.strength]).toStrictEqual([7, 33, 20])

      // Act: reserve20 for Attack Move and5 for an ordinary same-speed Move from one Alice source.
      const departureView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const attackAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
      const ordinaryAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(attackAction)
      Assert.isDefined(ordinaryAction)
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId: fixture.gameId,
        turn: departureView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          departureView,
          AttackMoveTest.id,
          { fleet: attackerSource.id, planet: fixture.aliceHome.id },
          { strength: 20 },
        ),
      })
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId: fixture.gameId,
        turn: departureView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          departureView,
          MoveFleetImproved.id,
          { fleet: attackerSource.id, planet: fixture.aliceHome.id },
          { strength: 5 },
        ),
      })
      const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total - 8)
      expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total - 4)
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: departureView.turn,
        turnProcessor: fixture.turnProcessor,
      })
      let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      let attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
      let ordinaryJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === ordinaryAction.id)
      Assert.isDefined(attackJourney)
      Assert.isDefined(ordinaryJourney)
      expect([attackJourney.strength, attackJourney.distanceToEnd, ordinaryJourney.strength, ordinaryJourney.distanceToEnd]).toStrictEqual([
        20, 3.418312565270031, 5, 3.418312565270031,
      ])
      expect(movingView.fleets.find(({ id }) => id === attackerSource.id)?.strength).toBe(8)
      for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
        await processPublicTurn({
          clients: fixture.clients,
          gameId: fixture.gameId,
          turn: movingView.turn,
          turnProcessor: fixture.turnProcessor,
        })
        movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        attackJourney = movingView.fleets.find(({ id }) => id === attackJourney?.id)
        ordinaryJourney = movingView.fleets.find(({ id }) => id === ordinaryJourney?.id)
        Assert.isDefined(attackJourney)
        Assert.isDefined(ordinaryJourney)
        expect([attackJourney.distanceToEnd, ordinaryJourney.distanceToEnd]).toStrictEqual([remainingDistance, remainingDistance])
        expect(movingView.fleets.find(({ id }) => id === initialFriendly.id)?.strength).toBe(7)
        expect(movingView.fleets.find(({ id }) => id === enemy.id)?.strength).toBe(20)
      }

      // Act: Build10 on the arrival turn, capture the production-loaded input, and replay independent copies.
      const beforeCombat = movingView
      const buildAction = beforeCombat.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      expect(attackJourney.distanceToEnd).toBe(0.418312565270031)
      expect(ordinaryJourney.distanceToEnd).toBe(0.418312565270031)
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId: fixture.gameId,
        turn: beforeCombat.turn,
        submittedActionTargets: getActionToSubmintegrationTest(beforeCombat, BuildFleetStandard.id, { planet: fixture.aliceHome.id }),
      })
      const beforeCombatViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: beforeCombat.turn,
        turnProcessor: fixture.turnProcessor,
        process: false,
      })
      const observed = await observeTurnAndRollback({
        db,
        clock,
        turnsRepository: fixture.turnsRepository,
        gameId: fixture.gameId,
        turn: beforeCombat.turn,
      })
      const forward = replayObservedTurn(observed, false)
      const permuted = replayObservedTurn(observed, true)
      const expectedTargetForces = { [playerAId]: [22], [playerBId]: [] }
      expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(expectedTargetForces)
      expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(expectedTargetForces)
      expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual({
        [playerAId]: [8],
        [playerBId]: [],
      })
      expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
      expect(forward.rngState).toStrictEqual(permuted.rngState)
      expect(
        Object.values(forward.resolved.fleets)
          .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
          .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
      ).toStrictEqual(
        Object.values(permuted.resolved.fleets)
          .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
          .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
      )
      expect(forward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([attackJourney.id, ordinaryJourney.id, enemy.id]))
      const attackContinuations = forward.resolved.resolvedContinuations.filter(
        ({ originatingSubmission }) => originatingSubmission.playerId === playerAId && originatingSubmission.id === attackAction.id,
      )
      expect(attackContinuations).toHaveLength(1)
      const attackContinuation = attackContinuations[0]
      Assert.isDefined(attackContinuation)
      expect(attackContinuation.actionOutcomes).toHaveLength(3)
      const attackResults = attackContinuation.actionOutcomes.filter(
        (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
          outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
      )
      const movementResults = attackContinuation.actionOutcomes.filter(
        (outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" moved "),
      )
      const mergeResults = attackContinuation.actionOutcomes.filter(
        (outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" arrived on ") && outcome.result.includes(" merged "),
      )
      expect(movementResults).toHaveLength(1)
      expect(mergeResults).toHaveLength(1)
      expect(attackResults).toHaveLength(1)
      const attackOutcome = attackResults[0]
      Assert.isDefined(attackOutcome)
      expect(attackOutcome.result).toContain("exchanged 20 Strength with 20 enemy Strength")
      const ordinaryContinuations = forward.resolved.resolvedContinuations.filter(
        ({ originatingSubmission }) => originatingSubmission.playerId === playerAId && originatingSubmission.id === ordinaryAction.id,
      )
      expect(ordinaryContinuations).toHaveLength(1)
      const ordinaryContinuation = ordinaryContinuations[0]
      Assert.isDefined(ordinaryContinuation)
      expect(
        ordinaryContinuation.actionOutcomes.filter((outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" exchanged ")),
      ).toHaveLength(0)

      // Assert: the real worker saves the original friendly identity at22, preserves source8, removes all children/enemy, and charges once.
      expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
      const afterCombat = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      for (let ownerIndex = 0; ownerIndex < afterCombat.length; ownerIndex += 1) {
        const view = afterCombat[ownerIndex]
        const before = beforeCombatViews[ownerIndex]
        const ownerPlayerId = fixture.playerIds[ownerIndex]
        Assert.isDefined(view)
        Assert.isDefined(before)
        Assert.isDefined(ownerPlayerId)
        expect(view.fleets.find(({ id }) => id === initialFriendly.id)).toMatchObject({
          id: initialFriendly.id,
          name: initialFriendly.name,
          ownerPlayerId: playerAId,
          originPlanetId: fixture.aliceHome.id,
          strength: 22,
        })
        expect(view.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
        expect(view.fleets.find(({ id }) => id === attackJourney.id)).toBeUndefined()
        expect(view.fleets.find(({ id }) => id === ordinaryJourney.id)).toBeUndefined()
        expect(view.fleets.find(({ id }) => id === attackerSource.id)).toMatchObject({ id: attackerSource.id, strength: 8 })
        expect(view.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
        expect(view.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
        expect(view.actions.find(({ id }) => id === buildAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
        const aliceBuildInfluenceCost = ownerPlayerId === playerAId ? 2 : 0
        const aliceBuildMetalCost = ownerPlayerId === playerAId ? 1 : 0
        expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - aliceBuildInfluenceCost)
        expect(view.resources[ResourceType.METAL].total).toBe(before.resources[ResourceType.METAL].total - aliceBuildMetalCost)
        expect(view.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total)
      }
      const nextTurn = afterCombat[0]
      Assert.isDefined(nextTurn)
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: nextTurn.turn,
        turnProcessor: fixture.turnProcessor,
        process: false,
      })
      const emptyObserved = await observeTurnAndRollback({
        db,
        clock,
        turnsRepository: fixture.turnsRepository,
        gameId: fixture.gameId,
        turn: nextTurn.turn,
      })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
      logWorkerObservation(
        "[I2-08 natural merged Build and arrival observation]",
        JSON.stringify({ generatorState: observed.rngState.generatorState, nextState: emptyObserved.rngState }),
      )
      expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
    },
  )
  integrationTest("should include an enemy same-turn Build in a public arrival Assault", { timeout: 180_000 }, async ({ db }) => {
    // Arrange: leave Alice40 at her home, stage Bob20 at that origin, and retain Bob20 at his home.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
    using apiServer = new ApiServer(apiServices)
    const fixture = await createPublicHomeArrivalFixture({
      db,
      clock,
      apiServer,
      ruleset: HomeArrivalMergeRuleset,
      aliceDepartureStrength: 0,
      bobDepartureStrength: 20,
      bobStartingStrength: 40,
    })
    const alice = fixture.clients[0]
    const bob = fixture.clients[1]
    const playerAId = fixture.playerIds[0]
    const playerBId = fixture.playerIds[1]
    const attackerSource = fixture.aliceAtTarget
    const defender = fixture.bobAtSource
    Assert.isDefined(alice)
    Assert.isDefined(bob)
    Assert.isDefined(playerAId)
    Assert.isDefined(playerBId)
    Assert.isDefined(attackerSource)
    Assert.isDefined(defender)
    expect([attackerSource.strength, defender.strength, fixture.bobAtTarget?.strength]).toStrictEqual([40, 20, 20])
    expect(fixture.aliceAtSource).toBeUndefined()

    // Act: send Alice30 to Bob's home; the public Build action reinforces Bob's stationed20 on the arrival turn.
    const departureViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    const aliceDepartureView = departureViews[0]
    const bobDepartureView = departureViews[1]
    Assert.isDefined(aliceDepartureView)
    Assert.isDefined(bobDepartureView)
    const attackAction = aliceDepartureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
    Assert.isDefined(attackAction)
    const aliceBeforeDeparture = {
      influence: aliceDepartureView.resources[ResourceType.INFLUENCE].total,
      fuel: aliceDepartureView.resources[ResourceType.FUEL].total,
      metal: aliceDepartureView.resources[ResourceType.METAL].total,
    }
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: aliceDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        aliceDepartureView,
        AttackMoveTest.id,
        { fleet: attackerSource.id, planet: fixture.bobHome.id },
        { strength: 30 },
      ),
    })
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: aliceDepartureView.turn,
      turnProcessor: fixture.turnProcessor,
    })
    let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    let attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
    Assert.isDefined(attackJourney)
    expect([attackJourney.strength, attackJourney.distanceToEnd]).toStrictEqual([30, 3.418312565270031])
    expect(movingView.fleets.find(({ id }) => id === attackerSource.id)?.strength).toBe(10)
    for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: movingView.turn,
        turnProcessor: fixture.turnProcessor,
      })
      movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      attackJourney = movingView.fleets.find(({ id }) => id === attackJourney?.id)
      Assert.isDefined(attackJourney)
      expect(attackJourney.distanceToEnd).toBe(remainingDistance)
      expect(movingView.fleets.find(({ id }) => id === defender.id)?.strength).toBe(20)
    }
    const beforeCombatViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    const aliceBeforeCombat = beforeCombatViews[0]
    const bobBeforeCombat = beforeCombatViews[1]
    Assert.isDefined(aliceBeforeCombat)
    Assert.isDefined(bobBeforeCombat)
    const buildAction = bobBeforeCombat.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: bobBeforeCombat.turn,
      submittedActionTargets: getActionToSubmintegrationTest(bobBeforeCombat, BuildFleetStandard.id, { planet: fixture.bobHome.id }),
    })
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: aliceBeforeCombat.turn,
      turnProcessor: fixture.turnProcessor,
      process: false,
    })
    const observed = await observeTurnAndRollback({
      db,
      clock,
      turnsRepository: fixture.turnsRepository,
      gameId: fixture.gameId,
      turn: aliceBeforeCombat.turn,
    })
    const forward = replayObservedTurn(observed, false)
    const permuted = replayObservedTurn(observed, true)

    // Assert: Build reinforces defender20 to30 before the single A30 Assault; both target forces are removed.
    const expectedTargetForces = { [playerAId]: [], [playerBId]: [] }
    expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
    expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
    expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
      [playerAId]: [10],
      [playerBId]: [20],
    })
    expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
    expect(forward.rngState).toStrictEqual(permuted.rngState)
    expect(
      Object.values(forward.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    ).toStrictEqual(
      Object.values(permuted.resolved.fleets)
        .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
        .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
    )
    expect(forward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([attackJourney.id, defender.id]))
    const attackContinuations = forward.resolved.resolvedContinuations.filter(
      ({ originatingSubmission }) => originatingSubmission.playerId === playerAId && originatingSubmission.id === attackAction.id,
    )
    expect(attackContinuations).toHaveLength(1)
    const attackContinuation = attackContinuations[0]
    Assert.isDefined(attackContinuation)
    const assaultResults = attackContinuation.actionOutcomes.filter(
      (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
        outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
    )
    expect(assaultResults).toHaveLength(1)
    expect(assaultResults[0]?.result).toContain("exchanged 30 Strength with 30 enemy Strength")
    const buildActionResult = forward.resolved.resolvedActions.find(
      ({ submittedAction }) => submittedAction.playerId === playerBId && submittedAction.id === buildAction.id,
    )
    Assert.isDefined(buildActionResult)
    expect(buildActionResult.actionOutcomes).toHaveLength(3)
    expect(buildActionResult.actionOutcomes).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("spent 2 INFLUENCE") }),
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("spent 1 METAL") }),
        expect.objectContaining({
          type: "RESOLVED",
          result: expect.stringContaining(`reinforced Fleet "${defender.id}" by 10`),
        }),
      ]),
    )

    // Assert: the actual worker removes both target forces, preserves source10, releases the actions, and charges each owner correctly.
    expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
    const afterCombatViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    const beforeResourcesByOwner = [
      {
        influence: aliceBeforeDeparture.influence,
        fuel: aliceBeforeDeparture.fuel,
        metal: aliceBeforeDeparture.metal,
      },
      {
        influence: bobBeforeCombat.resources[ResourceType.INFLUENCE].total,
        fuel: bobBeforeCombat.resources[ResourceType.FUEL].total,
        metal: bobBeforeCombat.resources[ResourceType.METAL].total,
      },
    ]
    for (let ownerIndex = 0; ownerIndex < afterCombatViews.length; ownerIndex += 1) {
      const view = afterCombatViews[ownerIndex]
      const before = beforeResourcesByOwner[ownerIndex]
      const ownerPlayerId = fixture.playerIds[ownerIndex]
      Assert.isDefined(view)
      Assert.isDefined(before)
      Assert.isDefined(ownerPlayerId)
      expect(ownerPublicForces(view.fleets, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
      if (ownerPlayerId === playerAId) {
        expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.influence - 5)
        expect(view.resources[ResourceType.FUEL].total).toBe(before.fuel - 1)
        expect(view.resources[ResourceType.METAL].total).toBe(before.metal)
      } else {
        expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.influence - 2)
        expect(view.resources[ResourceType.METAL].total).toBe(before.metal - 1)
        expect(view.resources[ResourceType.FUEL].total).toBe(before.fuel)
      }
      expect(view.actions.find(({ id }) => id === (ownerPlayerId === playerAId ? attackAction.id : buildAction.id))).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
    }
    expect(afterCombatViews[0]?.fleets.find(({ id }) => id === attackerSource.id)?.strength).toBe(10)
  })
  integrationTest(
    "should resolve two distinct public Assault arrivals once each against the same defender",
    { timeout: 180_000 },
    async ({ db }) => {
      // Arrange: build and publicly stage Alice40 against Bob10 at Alice's home on the fixed seed-147 map.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
      using apiServer = new ApiServer(apiServices)
      const fixture = await createPublicHomeArrivalFixture({
        db,
        clock,
        apiServer,
        ruleset: HomeArrivalMergeRuleset,
        aliceDepartureStrength: 40,
        bobDepartureStrength: 10,
      })
      const alice = fixture.clients[0]
      const playerAId = fixture.playerIds[0]
      const playerBId = fixture.playerIds[1]
      const source = fixture.aliceAtSource
      const defender = fixture.bobAtTarget
      Assert.isDefined(alice)
      Assert.isDefined(playerAId)
      Assert.isDefined(playerBId)
      Assert.isDefined(source)
      Assert.isDefined(defender)
      expect(fixture.aliceAtTarget).toBeUndefined()
      expect([source.strength, defender.strength, fixture.distance]).toStrictEqual([40, 10, 4.418312565270031])

      // Act: reserve20 and15 through two distinct instances of the same pooled Attack Move definition.
      const departureViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      const departureView = departureViews[0]
      Assert.isDefined(departureView)
      const beforeResourcesByOwner = departureViews.map((view) => {
        Assert.isDefined(view)
        return {
          influence: view.resources[ResourceType.INFLUENCE].total,
          fuel: view.resources[ResourceType.FUEL].total,
        }
      })
      const beforePayment = beforeResourcesByOwner[0]
      Assert.isDefined(beforePayment)
      const firstAction = departureView.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_1")
      const secondAction = departureView.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
      Assert.isDefined(firstAction)
      Assert.isDefined(secondAction)

      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId: fixture.gameId,
        turn: departureView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          departureView,
          AttackMoveTest.id,
          { fleet: source.id, planet: fixture.aliceHome.id },
          { strength: 20 },
        ),
      })
      const secondSubmission = getActionToSubmintegrationTest(
        departureView,
        AttackMoveTest.id,
        { fleet: source.id, planet: fixture.aliceHome.id },
        { strength: 15 },
      )
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId: fixture.gameId,
        turn: departureView.turn,
        submittedActionTargets: { ...secondSubmission, actionId: secondAction.id },
      })
      const reservedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      expect(reservedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(beforePayment.influence - 10)
      expect(reservedView.resources[ResourceType.FUEL].uncommitted).toBe(beforePayment.fuel - 2)
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: departureView.turn,
        turnProcessor: fixture.turnProcessor,
      })

      // Assert: both captured journeys and the5-force source remainder persist across three intermediate worker reloads.
      let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const journeyIdByAction = new Map<string, typeof source.id>()
      const journeyForces = (
        view: PlayerView,
      ): Array<{
        id: PlayerView["fleets"][number]["id"]
        strength: number
        distanceToEnd: PlayerView["fleets"][number]["distanceToEnd"] | undefined
      }> =>
        [firstAction, secondAction].map((action) => {
          const journey = view.fleets.find(({ movement }) => movement?.submission.id === action.id)
          Assert.isDefined(journey)
          journeyIdByAction.set(action.id, journey.id)
          return { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd }
        })
      expect(journeyForces(movingView).map(({ strength, distanceToEnd }) => [strength, distanceToEnd])).toStrictEqual([
        [20, 3.418312565270031],
        [15, 3.418312565270031],
      ])
      expect(movingView.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
      for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
        await processPublicTurn({
          clients: fixture.clients,
          gameId: fixture.gameId,
          turn: movingView.turn,
          turnProcessor: fixture.turnProcessor,
        })
        movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(journeyForces(movingView).map(({ distanceToEnd }) => distanceToEnd)).toStrictEqual([remainingDistance, remainingDistance])
        expect(movingView.fleets.find(({ id }) => id === defender.id)?.strength).toBe(10)
        expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
          [playerAId]: [],
          [playerBId]: [10],
        })
      }

      // Act: observe the natural production-loaded arrival turn in a transaction that rolls back, then replay independent permutations.
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: movingView.turn,
        turnProcessor: fixture.turnProcessor,
        process: false,
      })
      const observed = await observeTurnAndRollback({
        db,
        clock,
        turnsRepository: fixture.turnsRepository,
        gameId: fixture.gameId,
        turn: movingView.turn,
      })
      const forward = replayObservedTurn(observed, false)
      const permuted = replayObservedTurn(observed, true)
      expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
        [playerAId]: [25],
        [playerBId]: [],
      })
      expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
        [playerAId]: [25],
        [playerBId]: [],
      })
      expect(forward.resolved.removedFleetIds).toContain(defender.id)
      const journeyIds = [firstAction.id, secondAction.id].map((actionId) => journeyIdByAction.get(actionId))
      expect(journeyIds.every((journeyId) => journeyId !== undefined)).toBe(true)
      const survivingArrivals = Object.values(forward.resolved.fleets).filter(
        ({ ownerPlayerId, originPlanetId, strength, movement }) =>
          ownerPlayerId === playerAId && originPlanetId === fixture.aliceHome.id && strength === 25 && movement === undefined,
      )
      expect(survivingArrivals).toHaveLength(1)
      const survivingArrival = survivingArrivals[0]
      Assert.isDefined(survivingArrival)
      expect(journeyIds).toContain(survivingArrival.id)
      expect(
        journeyIds.filter((journeyId) => journeyId !== undefined && forward.resolved.removedFleetIds.includes(journeyId)),
      ).toHaveLength(1)
      const observedContinuations = forward.resolved.resolvedContinuations
        .filter(({ originatingSubmission }) => originatingSubmission.playerId === playerAId)
        .toSorted((first, second) => compareOrdinalStrings(first.originatingSubmission.id, second.originatingSubmission.id))
      const permutedContinuations = permuted.resolved.resolvedContinuations
        .filter(({ originatingSubmission }) => originatingSubmission.playerId === playerAId)
        .toSorted((first, second) => compareOrdinalStrings(first.originatingSubmission.id, second.originatingSubmission.id))
      expect(
        observedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
          actionId: originatingSubmission.id,
          outcomes: actionOutcomes,
        })),
      ).toStrictEqual(
        permutedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
          actionId: originatingSubmission.id,
          outcomes: actionOutcomes,
        })),
      )
      const tieDraw = mulberry32FirstDraw(observed.rngState.generatorState)
      const canonicalActionIds = [firstAction.id, secondAction.id].toSorted(compareOrdinalStrings)
      const expectedActionOrder = tieDraw.value < 0.5 ? canonicalActionIds.toReversed() : canonicalActionIds
      expect(observedContinuations).toHaveLength(2)
      const perActionAssaultResults = observedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
        actionId: originatingSubmission.id,
        results: actionOutcomes.filter(
          (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
            outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
        ),
        noOpResults: actionOutcomes.filter(
          (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
            outcome.type === "RESOLVED" && outcome.result.includes(" found no enemy Fleets "),
        ),
      }))
      const firstAssaultSequence = perActionAssaultResults.find(({ actionId }) => actionId === expectedActionOrder[0])
      const secondAssaultSequence = perActionAssaultResults.find(({ actionId }) => actionId === expectedActionOrder[1])
      Assert.isDefined(firstAssaultSequence)
      Assert.isDefined(secondAssaultSequence)
      expect(firstAssaultSequence.results).toHaveLength(1)
      expect(firstAssaultSequence.results[0]?.result).toContain("exchanged 10 Strength with 10 enemy Strength")
      expect(firstAssaultSequence.noOpResults).toHaveLength(0)
      expect(secondAssaultSequence.results).toHaveLength(0)
      expect(secondAssaultSequence.noOpResults).toHaveLength(1)
      const secondNoOp = secondAssaultSequence.noOpResults[0]
      Assert.isDefined(secondNoOp)
      expect(secondNoOp.result).toContain("found no enemy Fleets")
      expect(forward.rngState).toStrictEqual({
        generatorState: tieDraw.nextGeneratorState,
        spareNormal: observed.rngState.spareNormal,
      })
      expect(permuted.rngState).toStrictEqual(forward.rngState)

      // Assert: the actual worker saves a single25 survivor, deletes the defender/merged child, and releases both pooled instances.
      expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
      const afterArrivalViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      for (let ownerIndex = 0; ownerIndex < afterArrivalViews.length; ownerIndex += 1) {
        const view = afterArrivalViews[ownerIndex]
        const baseline = beforeResourcesByOwner[ownerIndex]
        const ownerPlayerId = fixture.playerIds[ownerIndex]
        Assert.isDefined(view)
        Assert.isDefined(baseline)
        Assert.isDefined(ownerPlayerId)
        const targetForces = ownerPublicForces(view.fleets, fixture.playerIds, fixture.aliceHome.id)
        expect(targetForces).toStrictEqual({ [playerAId]: [25], [playerBId]: [] })
        expect(view.fleets.find(({ id }) => id === defender.id)).toBeUndefined()
        const paidInfluence = ownerPlayerId === playerAId ? 10 : 0
        const paidFuel = ownerPlayerId === playerAId ? 2 : 0
        expect(view.resources[ResourceType.INFLUENCE].total).toBe(baseline.influence - paidInfluence)
        expect(view.resources[ResourceType.FUEL].total).toBe(baseline.fuel - paidFuel)
        for (const action of [firstAction, secondAction]) {
          expect(view.actions.find(({ id }) => id === action.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
        }
      }
      expect(afterArrivalViews[0]?.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
      const actualSurvivingArrival = afterArrivalViews[0]?.fleets.find(
        ({ ownerPlayerId, originPlanetId, strength, movement }) =>
          ownerPlayerId === playerAId && originPlanetId === fixture.aliceHome.id && strength === 25 && movement === undefined,
      )
      Assert.isDefined(actualSurvivingArrival)
      expect(actualSurvivingArrival).toMatchObject({
        id: survivingArrival.id,
        name: survivingArrival.name,
        ownerPlayerId: playerAId,
        strength: 25,
        originPlanetId: fixture.aliceHome.id,
      })
      expect(journeyIds).toContain(actualSurvivingArrival.id)
      const mergedJourneyId = journeyIds.find((journeyId) => journeyId !== actualSurvivingArrival.id)
      Assert.isDefined(mergedJourneyId)
      expect(afterArrivalViews[0]?.fleets.find(({ id }) => id === mergedJourneyId)).toBeUndefined()
      const emptyTurn = afterArrivalViews[0]
      Assert.isDefined(emptyTurn)
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: emptyTurn.turn,
        turnProcessor: fixture.turnProcessor,
        process: false,
      })
      const emptyObserved = await observeTurnAndRollback({
        db,
        clock,
        turnsRepository: fixture.turnsRepository,
        gameId: fixture.gameId,
        turn: emptyTurn.turn,
      })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
      logWorkerObservation(
        "[I2-09 natural two-Assault worker observation]",
        JSON.stringify({
          generatorState: observed.rngState.generatorState,
          tieDraw: tieDraw.value,
          canonicalActionIds,
          selectedActionOrder: expectedActionOrder,
          replayNextState: forward.rngState,
          workerNextState: emptyObserved.rngState,
        }),
      )
      expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
      const afterEmptyViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )
      expect(
        afterEmptyViews[0]?.fleets
          .map(({ id, ownerPlayerId, originPlanetId, strength }) => ({ id, ownerPlayerId, originPlanetId, strength }))
          .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
      ).toStrictEqual(
        afterArrivalViews[0]?.fleets
          .map(({ id, ownerPlayerId, originPlanetId, strength }) => ({ id, ownerPlayerId, originPlanetId, strength }))
          .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
      )
    },
  )
  integrationTest("should settle a public ordinary arrival before a later Assault arrival", { timeout: 180_000 }, async ({ db }) => {
    // Arrange: establish Alice40 at Bob's home and Bob10 at Alice's home on the fixed public map.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
    using apiServer = new ApiServer(apiServices)
    const fixture = await createPublicHomeArrivalFixture({
      db,
      clock,
      apiServer,
      ruleset: HomeArrivalMergeRuleset,
      aliceDepartureStrength: 40,
      bobDepartureStrength: 10,
    })
    const alice = fixture.clients[0]
    const playerAId = fixture.playerIds[0]
    const playerBId = fixture.playerIds[1]
    const source = fixture.aliceAtSource
    const enemy = fixture.bobAtTarget
    Assert.isDefined(alice)
    Assert.isDefined(playerAId)
    Assert.isDefined(playerBId)
    Assert.isDefined(source)
    Assert.isDefined(enemy)
    expect(fixture.aliceAtTarget).toBeUndefined()
    expect([source.strength, enemy.strength, fixture.distance]).toStrictEqual([40, 10, 4.418312565270031])

    // Act: launch a speed-five ordinary20 first and a speed-one Attack Move15 from the same source.
    const departureViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    const departureView = departureViews[0]
    Assert.isDefined(departureView)
    const beforeResourcesByOwner = departureViews.map((view) => {
      Assert.isDefined(view)
      return {
        influence: view.resources[ResourceType.INFLUENCE].total,
        fuel: view.resources[ResourceType.FUEL].total,
      }
    })
    const beforeAlicePayment = beforeResourcesByOwner[0]
    Assert.isDefined(beforeAlicePayment)
    const ordinaryAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
    const attackAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
    Assert.isDefined(ordinaryAction)
    Assert.isDefined(attackAction)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: departureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        departureView,
        MoveFleetExceptional.id,
        { fleet: source.id, planet: fixture.aliceHome.id },
        { strength: 20 },
      ),
    })
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: departureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        departureView,
        AttackMoveTest.id,
        { fleet: source.id, planet: fixture.aliceHome.id },
        { strength: 15 },
      ),
    })
    const reservedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    expect(reservedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(beforeAlicePayment.influence - 8)
    expect(reservedView.resources[ResourceType.FUEL].uncommitted).toBe(beforeAlicePayment.fuel - 6)

    // Assert: on the first real arrival turn the ordinary fleet is stationed, while Attack15 is still in transit and no Assault ran.
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: departureView.turn,
      turnProcessor: fixture.turnProcessor,
      process: false,
    })
    const firstArrivalObservation = await observeTurnAndRollback({
      db,
      clock,
      turnsRepository: fixture.turnsRepository,
      gameId: fixture.gameId,
      turn: departureView.turn,
    })
    const firstArrivalForward = replayObservedTurn(firstArrivalObservation, false)
    const firstArrivalPermuted = replayObservedTurn(firstArrivalObservation, true)
    const firstArrivalForces = { [playerAId]: [20], [playerBId]: [10] }
    expect(ownerFleetForces(firstArrivalForward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
    expect(ownerFleetForces(firstArrivalPermuted.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
    expect(normalizedOutcomeSequence(firstArrivalForward.resolved)).toStrictEqual(normalizedOutcomeSequence(firstArrivalPermuted.resolved))
    expect(firstArrivalForward.rngState).toStrictEqual(firstArrivalPermuted.rngState)
    const firstArrivalOutcomes = [
      ...firstArrivalForward.resolved.resolvedActions.flatMap(({ actionOutcomes }) => actionOutcomes),
      ...firstArrivalForward.resolved.resolvedContinuations.flatMap(({ actionOutcomes }) => actionOutcomes),
    ]
    expect(
      firstArrivalOutcomes.filter(
        (outcome) =>
          outcome.type === "RESOLVED" && (outcome.result.includes(" exchanged ") || outcome.result.includes(" found no enemy Fleets ")),
      ),
    ).toHaveLength(0)
    expect(
      Object.values(firstArrivalForward.resolved.fleets).find(
        ({ ownerPlayerId, originPlanetId, strength, movement }) =>
          ownerPlayerId === playerAId && originPlanetId === fixture.aliceHome.id && strength === 20 && movement === undefined,
      ),
    ).toBeDefined()

    expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
    let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    const ordinaryArrival = movingView.fleets.find(
      ({ ownerPlayerId, originPlanetId, strength, movement }) =>
        ownerPlayerId === playerAId && originPlanetId === fixture.aliceHome.id && strength === 20 && movement === undefined,
    )
    const attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
    Assert.isDefined(ordinaryArrival)
    Assert.isDefined(attackJourney)
    const attackJourneyId = attackJourney.id
    expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
    expect([attackJourney.strength, attackJourney.distanceToEnd, attackJourney.movement?.speed]).toStrictEqual([15, 3.418312565270031, 1])
    expect(movingView.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
    expect(movingView.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(movingView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ isInProgress: true })
    for (let ownerIndex = 0; ownerIndex < fixture.clients.length; ownerIndex += 1) {
      const ownerView = await fixture.clients[ownerIndex]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const baseline = beforeResourcesByOwner[ownerIndex]
      Assert.isDefined(ownerView)
      Assert.isDefined(baseline)
      expect(ownerView.resources[ResourceType.INFLUENCE].total).toBe(
        baseline.influence - (fixture.playerIds[ownerIndex] === playerAId ? 8 : 0),
      )
      expect(ownerView.resources[ResourceType.FUEL].total).toBe(baseline.fuel - (fixture.playerIds[ownerIndex] === playerAId ? 6 : 0))
    }

    // Assert: the already-stationed ordinary20 coexists with enemy10 through each later travel turn.
    for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
      await processPublicTurn({
        clients: fixture.clients,
        gameId: fixture.gameId,
        turn: movingView.turn,
        turnProcessor: fixture.turnProcessor,
      })
      movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const stationaryOrdinaryArrival = movingView.fleets.find(({ id }) => id === ordinaryArrival.id)
      expect(stationaryOrdinaryArrival).toMatchObject({ id: ordinaryArrival.id, name: ordinaryArrival.name, strength: 20 })
      expect(stationaryOrdinaryArrival?.movement).toBeUndefined()
      expect(movingView.fleets.find(({ id }) => id === enemy.id)).toMatchObject({ id: enemy.id, strength: 10 })
      expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
      const inTransitAttack = movingView.fleets.find(({ id }) => id === attackJourneyId)
      Assert.isDefined(inTransitAttack)
      expect(inTransitAttack.distanceToEnd).toBe(remainingDistance)
    }

    // Act: capture the later Attack15 arrival, then compare a replay with permuted public submission order.
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: movingView.turn,
      turnProcessor: fixture.turnProcessor,
      process: false,
    })
    const attackArrivalObservation = await observeTurnAndRollback({
      db,
      clock,
      turnsRepository: fixture.turnsRepository,
      gameId: fixture.gameId,
      turn: movingView.turn,
    })
    const attackArrivalForward = replayObservedTurn(attackArrivalObservation, false)
    const attackArrivalPermuted = replayObservedTurn(attackArrivalObservation, true)
    const finalTargetForces = { [playerAId]: [25], [playerBId]: [] }
    expect(ownerFleetForces(attackArrivalForward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(finalTargetForces)
    expect(ownerFleetForces(attackArrivalPermuted.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(finalTargetForces)
    expect(normalizedOutcomeSequence(attackArrivalForward.resolved)).toStrictEqual(
      normalizedOutcomeSequence(attackArrivalPermuted.resolved),
    )
    expect(attackArrivalForward.rngState).toStrictEqual(attackArrivalPermuted.rngState)
    expect(attackArrivalForward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([attackJourneyId, enemy.id]))
    const survivingArrival = Object.values(attackArrivalForward.resolved.fleets).find(
      ({ id, ownerPlayerId, originPlanetId, strength, movement }) =>
        id === ordinaryArrival.id &&
        ownerPlayerId === playerAId &&
        originPlanetId === fixture.aliceHome.id &&
        strength === 25 &&
        movement === undefined,
    )
    Assert.isDefined(survivingArrival)
    expect(survivingArrival.name).toBe(ordinaryArrival.name)
    const attackContinuations = attackArrivalForward.resolved.resolvedContinuations.filter(
      ({ originatingSubmission }) => originatingSubmission.playerId === playerAId && originatingSubmission.id === attackAction.id,
    )
    expect(attackContinuations).toHaveLength(1)
    const attackContinuation = attackContinuations[0]
    Assert.isDefined(attackContinuation)
    const assaultResults = attackContinuation.actionOutcomes.filter(
      (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
        outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
    )
    expect(assaultResults).toHaveLength(1)
    expect(assaultResults[0]?.result).toContain("exchanged 10 Strength with 10 enemy Strength")

    // Assert: the worker persists the old ordinary fleet identity at25, removes the arriving child/enemy, and releases both orders.
    expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
    const arrivalViews = await Promise.all(
      fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
    )
    for (let ownerIndex = 0; ownerIndex < arrivalViews.length; ownerIndex += 1) {
      const view = arrivalViews[ownerIndex]
      const baseline = beforeResourcesByOwner[ownerIndex]
      const ownerPlayerId = fixture.playerIds[ownerIndex]
      Assert.isDefined(view)
      Assert.isDefined(baseline)
      Assert.isDefined(ownerPlayerId)
      expect(ownerPublicForces(view.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(finalTargetForces)
      const savedOrdinaryArrival = view.fleets.find(({ id }) => id === ordinaryArrival.id)
      expect(savedOrdinaryArrival).toMatchObject({ id: ordinaryArrival.id, name: ordinaryArrival.name, strength: 25 })
      expect(savedOrdinaryArrival?.movement).toBeUndefined()
      expect(view.fleets.find(({ id }) => id === attackJourneyId)).toBeUndefined()
      expect(view.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
      expect(view.resources[ResourceType.INFLUENCE].total).toBe(baseline.influence - (ownerPlayerId === playerAId ? 8 : 0))
      expect(view.resources[ResourceType.FUEL].total).toBe(baseline.fuel - (ownerPlayerId === playerAId ? 6 : 0))
      expect(view.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
      expect(view.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
    expect(arrivalViews[0]?.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
  })
  integrationTest("should resolve the exact public defender30/outgoing20/incoming5/Build10 worker control", async ({ db }) => {
    // Arrange: use a stable public seed-147 game and build defender40/enemy20 through real API submissions and worker turns.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(WorkerI207Ruleset))
    using apiServer = new ApiServer(apiServices)
    const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
    const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
    const clients = [alice, bob]
    const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)]
    const turnInterval = Time.create(10, UnitOfTime.SECONDS)
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: WorkerI207Ruleset.id,
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
    const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
    Assert.isDefined(target)
    Assert.isDefined(bobHome)
    expect(target).toMatchObject({
      id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
      name: "planet 552840",
      coordinates: "45:83:40",
      x: 53.24122006799319,
      y: 48.68601626316641,
    })
    expect(bobHome).toMatchObject({
      id: "ec56a9af-3995-521c-822d-84685a96fdc6",
      name: "planet 819299",
      coordinates: "44:98:05",
      x: 48.987456457561635,
      y: 49.880579392930315,
    })

    for (let buildRound = 0; buildRound < 4; buildRound += 1) {
      const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
      for (const [ownerIndex, client] of clients.entries()) {
        const view = views[ownerIndex]
        const home = ownerIndex === 0 ? target : bobHome
        Assert.isDefined(view)
        if (buildRound < (ownerIndex === 0 ? 4 : 2)) {
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
    const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceInitial = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
    )
    const bobInitial = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
    )
    Assert.isDefined(aliceInitial)
    Assert.isDefined(bobInitial)
    expect(aliceInitial.strength).toBe(40)
    expect(bobInitial.strength).toBe(20)

    // Act: stage ten at Bob's home. Speed5 carries it there on this worker turn, leaving defender30.
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        builtView,
        MoveFleetExceptional.id,
        { fleet: aliceInitial.id, planet: bobHome.id },
        { strength: 10 },
      ),
    })
    await processPublicTurn({ clients, gameId, turn: builtView.turn, turnProcessor })
    const afterSplit = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceAtStaging = afterSplit.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[0] && originPlanetId === bobHome.id && movement === undefined,
    )
    const bobStagingFleet = afterSplit.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
    )
    expect(afterSplit.fleets.find(({ id }) => id === aliceInitial.id)?.strength).toBe(30)
    Assert.isDefined(aliceAtStaging)
    Assert.isDefined(bobStagingFleet)
    expect(aliceAtStaging.strength).toBe(10)
    expect(bobStagingFleet.strength).toBe(20)

    // Act: Bob submits Attack Move. Its first one-unit advance occurs on this same worker turn.
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: afterSplit.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        await bob.client.gameplay.getPlayerView.query({ gameId }),
        AttackMoveTest.id,
        { fleet: bobStagingFleet.id, planet: target.id },
        { strength: 20 },
      ),
    })
    await processPublicTurn({ clients, gameId, turn: afterSplit.turn, turnProcessor })
    for (let advance = 0; advance < 3; advance += 1) {
      const view = await alice.client.gameplay.getPlayerView.query({ gameId })
      await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
    }
    const beforeArrival = await alice.client.gameplay.getPlayerView.query({ gameId })
    const enemyJourney = beforeArrival.fleets.find(
      ({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[1] && movement !== undefined,
    )
    const defender = beforeArrival.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
    )
    Assert.isDefined(enemyJourney)
    Assert.isDefined(defender)
    expect(defender.strength).toBe(30)
    expect(aliceAtStaging.strength).toBe(10)
    expect(enemyJourney).toMatchObject({
      strength: 20,
      distanceToEnd: 0.418312565270031,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })

    // Act: on the combat turn, submit friendly5 arrival, outgoing20 ordinary Move and Build10 together.
    const aliceFinalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const inboundAction = aliceFinalView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
    const outboundAction = aliceFinalView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
    Assert.isDefined(inboundAction)
    Assert.isDefined(outboundAction)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceFinalView.turn,
      submittedActionTargets: {
        actionId: inboundAction.id,
        selectedTargets: { fleet: aliceAtStaging.id, planet: target.id },
        selectedInputs: { strength: 5 },
      },
    })
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceFinalView.turn,
      submittedActionTargets: {
        actionId: outboundAction.id,
        selectedTargets: { fleet: defender.id, planet: bobHome.id },
        selectedInputs: { strength: 20 },
      },
    })
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceFinalView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(aliceFinalView, BuildFleetStandard.id, { planet: target.id }),
    })
    await processPublicTurn({ clients, gameId, turn: aliceFinalView.turn, turnProcessor })

    // Assert: the real worker resolves arrivals, outgoing split, Build and Combat in order, preserving force identities.
    const afterCombat = await alice.client.gameplay.getPlayerView.query({ gameId })
    const defenderAfter = afterCombat.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
    )
    const outboundJourney = afterCombat.fleets.find(
      ({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[0] && movement?.submission.id === outboundAction.id,
    )
    Assert.isDefined(defenderAfter)
    Assert.isDefined(outboundJourney)
    expect(defenderAfter).toMatchObject({ id: defender.id, name: defender.name, strength: 5 })
    expect(outboundJourney).toMatchObject({
      strength: 20,
      originPlanetId: target.id,
      destinationPlanetId: bobHome.id,
      movement: { speed: 0.1 },
      distanceToEnd: 4.318312565270031,
    })
    expect(afterCombat.fleets.some(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])).toBe(false)
    expect(afterCombat.fleets.find(({ id }) => id === aliceAtStaging.id)?.strength).toBe(5)
    expect(
      afterCombat.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)?.ownerPlayerId,
    ).toBe(playerIds[0])
    expect(afterCombat.actions.find(({ id }) => id === enemyJourney.movement?.submission.id)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    const emptyTurn = afterCombat.turn
    await processPublicTurn({ clients, gameId, turn: emptyTurn, turnProcessor, process: false })
    const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn })
    expect(emptyObserved.submittedActions).toStrictEqual([])
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(afterEmpty.fleets.find(({ id }) => id === defenderAfter.id)?.strength).toBe(5)
    expect(afterEmpty.fleets.find(({ id }) => id === outboundJourney.id)?.strength).toBe(20)
  })

  integrationTest("should treat a full outgoing fleet as absent when the real worker resolves a later enemy arrival", async ({ db }) => {
    // Arrange: create the stable public two-player map and build A30/B20 through public actions and worker turns.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(WorkerI207Ruleset))
    using apiServer = new ApiServer(apiServices)
    const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
    const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
    const clients = [alice, bob]
    const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)]
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: WorkerI207Ruleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })
    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
    const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
    Assert.isDefined(target)
    Assert.isDefined(bobHome)
    for (let buildRound = 0; buildRound < 3; buildRound += 1) {
      const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
      for (const [ownerIndex, client] of clients.entries()) {
        const view = views[ownerIndex]
        const home = ownerIndex === 0 ? target : bobHome
        Assert.isDefined(view)
        if ((buildRound < 3 && ownerIndex === 0) || (buildRound < 2 && ownerIndex === 1)) {
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
    const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const defender = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[0] && originPlanetId === target.id && movement === undefined,
    )
    const enemy = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
    )
    Assert.isDefined(defender)
    Assert.isDefined(enemy)
    expect(defender.strength).toBe(30)
    expect(enemy.strength).toBe(20)

    // Act: start a public enemy Attack Move and let its persisted movement advance to its literal final remainder.
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        await bob.client.gameplay.getPlayerView.query({ gameId }),
        AttackMoveTest.id,
        { fleet: enemy.id, planet: target.id },
        { strength: 20 },
      ),
    })
    await processPublicTurn({ clients, gameId, turn: builtView.turn, turnProcessor })
    for (let advance = 0; advance < 3; advance += 1) {
      const view = await alice.client.gameplay.getPlayerView.query({ gameId })
      await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
    }
    const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const nearEnemy = arrivalView.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[1] && movement !== undefined)
    Assert.isDefined(nearEnemy)
    expect(nearEnemy.distanceToEnd).toBe(0.418312565270031)
    expect(arrivalView.fleets.find(({ id }) => id === defender.id)?.strength).toBe(30)

    // Act: move all thirty defender Strength away through a public ordinary Move while the enemy Assault arrives.
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: arrivalView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        arrivalView,
        MoveFleetStandard.id,
        { fleet: defender.id, planet: bobHome.id },
        { strength: 30 },
      ),
    })
    await processPublicTurn({ clients, gameId, turn: arrivalView.turn, turnProcessor })

    // Assert: the transit-origin fleet does not defend the target; the Assault resolves as an empty-target no-op.
    const afterCombat = await alice.client.gameplay.getPlayerView.query({ gameId })
    const outbound = afterCombat.fleets.find(({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[0] && movement !== undefined)
    const arrivedEnemy = afterCombat.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerIds[1] && originPlanetId === target.id && movement === undefined,
    )
    Assert.isDefined(outbound)
    Assert.isDefined(arrivedEnemy)
    expect(outbound).toMatchObject({
      strength: 30,
      originPlanetId: target.id,
      destinationPlanetId: bobHome.id,
      movement: { speed: 0.1 },
      distanceToEnd: 4.318312565270031,
    })
    expect(afterCombat.fleets.find(({ id }) => id === defender.id)).toBeUndefined()
    expect(arrivedEnemy.strength).toBe(20)
    expect(afterCombat.actions.find(({ id }) => id === nearEnemy.movement?.submission.id)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
  })

  integrationTest("should persist composed Assault intent through public turns and resolve it once after reload", async ({ db }) => {
    // Arrange: create the genuine public game, build its fleets, and establish the immutable seed-147 map fixture.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
    using apiServer = new ApiServer(apiServices)
    const alice = await apiServer.createClient({ authenticated: true })
    const bob = await apiServer.createClient({ authenticated: true })
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

    const alicePlayerId = branded<PlayerId>(alice.account.id)
    const bobPlayerId = branded<PlayerId>(bob.account.id)
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })
    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === alicePlayerId)
    const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobPlayerId)
    Assert.isDefined(aliceHome)
    Assert.isDefined(bobHome)
    expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
    expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

    const processReadyTurn = async (turn: number): Promise<void> => {
      await alice.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
      await bob.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    }

    for (let buildTurn = 1; buildTurn <= 5; buildTurn += 1) {
      const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: aliceView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
      })
      if (buildTurn <= 2) {
        const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        await bob.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: bobView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: bobHome.id }),
        })
      }
      await processReadyTurn(aliceView.turn)
    }

    const readyForAttack = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceSource = readyForAttack.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === alicePlayerId && originPlanetId === aliceHome.id && movement === undefined,
    )
    const bobDefender = readyForAttack.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === bobPlayerId && originPlanetId === bobHome.id && movement === undefined,
    )
    Assert.isDefined(aliceSource)
    Assert.isDefined(bobDefender)
    expect(aliceSource.strength).toBe(50)
    expect(bobDefender.strength).toBe(20)
    const assaultAction = readyForAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === FlexibleAssaultTest.id)
    Assert.isDefined(assaultAction)

    // Act: submit the composed departure through the public API and advance it through the production worker.
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: readyForAttack.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        readyForAttack,
        FlexibleAssaultTest.id,
        { source: aliceSource.id, destination: bobHome.id },
        { force: 30 },
      ),
    })
    const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 90, uncommitted: 83 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 98 })
    expect(selectedView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(50)

    // Assert: the public readiness API closes the turn; the real resolver saves through the worker repository.
    await processReadyTurn(readyForAttack.turn)
    const firstSavedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const firstJourney = firstSavedView.fleets.find(({ movement }) => movement?.submission.id === assaultAction.id)
    const firstRemainder = firstSavedView.fleets.find(({ id }) => id === aliceSource.id)
    Assert.isDefined(firstJourney)
    Assert.isDefined(firstJourney.movement)
    Assert.isDefined(firstRemainder)
    expect(firstJourney).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: bobHome.id })
    expect(firstJourney.movement).toMatchObject({
      speed: 2,
      departureTurn: readyForAttack.turn,
      submission: {
        id: assaultAction.id,
        playerId: alicePlayerId,
        actionDefinitionId: FlexibleAssaultTest.id,
        selectedTargets: { source: aliceSource.id, destination: bobHome.id },
        selectedInputs: { force: 30 },
      },
      pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
    })
    expect(firstRemainder).toMatchObject({ strength: 20, originPlanetId: aliceHome.id })
    expect(firstSavedView.actions.find(({ id }) => id === assaultAction.id)?.isInProgress).toBe(true)
    expect(firstSavedView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)

    await processReadyTurn(firstSavedView.turn)
    const secondSavedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const secondJourney = secondSavedView.fleets.find(({ id }) => id === firstJourney.id)
    Assert.isDefined(secondJourney)
    expect(secondJourney.distanceToEnd).toBe(0.418312565270031)
    expect(secondSavedView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    expect(secondSavedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
    expect(secondSavedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

    await processReadyTurn(secondSavedView.turn)
    const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const arrivedFleet = arrivalView.fleets.find(({ id }) => id === firstJourney.id)
    Assert.isDefined(arrivedFleet)
    expect(arrivedFleet).toStrictEqual({
      id: firstJourney.id,
      name: firstJourney.name,
      ownerPlayerId: alicePlayerId,
      strength: 10,
      originPlanetId: bobHome.id,
    })
    expect(arrivalView.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === aliceSource.id)).toMatchObject({ strength: 20, originPlanetId: aliceHome.id })
    expect(arrivalView.actions.find(({ id }) => id === assaultAction.id)?.isInProgress).toBe(false)
    expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 83, uncommitted: 83 })
    expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 98, uncommitted: 98 })

    await processReadyTurn(arrivalView.turn)
    const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(afterEmptyTurn.fleets.find(({ id }) => id === firstJourney.id)?.strength).toBe(10)
    expect(afterEmptyTurn.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  })

  integrationTest(
    "should save an exact speed-two 5I/1F Assault across public worker reloads and preserve a friendly survivor",
    async ({ db }) => {
      // Arrange: create the authenticated public clients and helpers for supported game setup and worker turns.
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(AssaultWorkerRuleset))
      using apiServer = new ApiServer(apiServices)
      const alice = await apiServer.createClient({ authenticated: true })
      const bob = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      const processReadyTurn = async (gameId: number, turn: number): Promise<void> => {
        await alice.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
        await bob.client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      const createBuiltGame = async (): Promise<{
        gameId: number
        aliceHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
        bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
        source: PlayerView["fleets"][number]
        defender: PlayerView["fleets"][number]
      }> => {
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
        const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
        const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
        const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        const bobHome = bobView.galaxy.systems
          .flatMap(({ planets }) => planets)
          .find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
        Assert.isDefined(aliceHome)
        Assert.isDefined(bobHome)
        expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
        expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

        for (let buildTurn = 1; buildTurn <= 5; buildTurn += 1) {
          const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: aliceView.turn,
            submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
          })
          if (buildTurn <= 2) {
            const currentBobView = await bob.client.gameplay.getPlayerView.query({ gameId })
            await bob.client.gameplay.updateActionSubmission.mutate({
              gameId,
              turn: currentBobView.turn,
              submittedActionTargets: getActionToSubmintegrationTest(currentBobView, BuildFleetStandard.id, { planet: bobHome.id }),
            })
          }
          await processReadyTurn(gameId, aliceView.turn)
        }

        const readyView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const source = readyView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === readyView.player.id && originPlanetId === aliceHome.id && movement === undefined,
        )
        const defender = readyView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId !== readyView.player.id && originPlanetId === bobHome.id && movement === undefined,
        )
        Assert.isDefined(source)
        Assert.isDefined(defender)
        expect(source.strength).toBe(50)
        expect(defender.strength).toBe(20)
        return { gameId, aliceHome, bobHome, source, defender }
      }

      const runCombat = async (fixture: Awaited<ReturnType<typeof createBuiltGame>>, moveFriendlyGuard: boolean): Promise<void> => {
        let friendlyGuard: typeof fixture.source | undefined
        if (moveFriendlyGuard) {
          // Act: move the friendly force through submitted actions and real worker turns before the Assault.
          const beforeMove = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId: fixture.gameId,
            turn: beforeMove.turn,
            submittedActionTargets: getActionToSubmintegrationTest(
              beforeMove,
              MoveFleetImproved.id,
              { fleet: fixture.source.id, planet: fixture.bobHome.id },
              { strength: 7 },
            ),
          })
          await processReadyTurn(fixture.gameId, beforeMove.turn)
          let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
          const moveAction = movingView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
          Assert.isDefined(moveAction)
          const movingGuard = movingView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
          Assert.isDefined(movingGuard)
          Assert.isDefined(movingGuard.movement)
          expect(movingGuard).toMatchObject({ strength: 7, distanceToEnd: 3.418312565270031 })
          for (let moveTurn = 0; moveTurn < 4; moveTurn += 1) {
            await processReadyTurn(fixture.gameId, movingView.turn)
            movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
            expect(movingView.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
            if (moveTurn < 3) {
              const continuedGuard: PlayerView["fleets"][number] | undefined = movingView.fleets.find(({ id }) => id === movingGuard.id)
              Assert.isDefined(continuedGuard)
              const expectedRemainder = [2.418312565270031, 1.418312565270031, 0.418312565270031][moveTurn]
              expect(continuedGuard.distanceToEnd).toBe(expectedRemainder)
            }
          }
          friendlyGuard = movingView.fleets.find(
            ({ ownerPlayerId, originPlanetId, movement }) =>
              ownerPlayerId === movingView.player.id && originPlanetId === fixture.bobHome.id && movement === undefined,
          )
          Assert.isDefined(friendlyGuard)
          expect(friendlyGuard).toMatchObject({ strength: 7, name: movingGuard.name, id: movingGuard.id })
          expect(movingView.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        }

        const beforeAttack = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const attackAction = beforeAttack.actions.find(({ actionDefinitionId }) => actionDefinitionId === SpeedTwoAssaultWorkerTest.id)
        Assert.isDefined(attackAction)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId: fixture.gameId,
          turn: beforeAttack.turn,
          submittedActionTargets: getActionToSubmintegrationTest(
            beforeAttack,
            SpeedTwoAssaultWorkerTest.id,
            { source: fixture.source.id, destination: fixture.bobHome.id },
            { force: 30 },
          ),
        })
        const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const expectedInfluenceUncommitted = moveFriendlyGuard ? 82 : 85
        const expectedFuelUncommitted = moveFriendlyGuard ? 96 : 99
        expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(expectedInfluenceUncommitted)
        expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(expectedFuelUncommitted)

        // Act: lock the exact 5/1 Attack Move and verify its persisted remainder on every worker reload.
        await processReadyTurn(fixture.gameId, beforeAttack.turn)
        const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
        Assert.isDefined(journey)
        expect(journey).toMatchObject({ strength: 30, distanceToEnd: 2.418312565270031, destinationPlanetId: fixture.bobHome.id })
        expect(firstReload.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({
          total: expectedInfluenceUncommitted,
          uncommitted: expectedInfluenceUncommitted,
        })
        expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({
          total: expectedFuelUncommitted,
          uncommitted: expectedFuelUncommitted,
        })

        await processReadyTurn(fixture.gameId, firstReload.turn)
        const secondReload = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(secondReload.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(0.418312565270031)
        expect(secondReload.fleets.find(({ id }) => id === fixture.defender.id)?.strength).toBe(20)
        expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(expectedInfluenceUncommitted)
        expect(secondReload.resources[ResourceType.FUEL].total).toBe(expectedFuelUncommitted)

        await processReadyTurn(fixture.gameId, secondReload.turn)
        // Assert: arrival combat preserves the correct owner, survivor identity, resources, and next-turn release.
        const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(arrivalView.fleets.find(({ id }) => id === fixture.defender.id)).toBeUndefined()
        if (friendlyGuard === undefined) {
          expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toMatchObject({ strength: 10, originPlanetId: fixture.bobHome.id })
        } else {
          expect(arrivalView.fleets.find(({ id }) => id === friendlyGuard?.id)).toMatchObject({
            id: friendlyGuard.id,
            name: friendlyGuard.name,
            strength: 17,
            originPlanetId: fixture.bobHome.id,
          })
          expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
        }
        expect(arrivalView.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(false)
        await processReadyTurn(fixture.gameId, arrivalView.turn)
        const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
        expect(afterEmptyTurn.fleets.find(({ id }) => id === (friendlyGuard?.id ?? journey.id))?.strength).toBe(
          friendlyGuard === undefined ? 10 : 17,
        )
        expect(afterEmptyTurn.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
          selectedTargets: null,
          isInProgress: false,
        })
      }

      await runCombat(await createBuiltGame(), false)
      await runCombat(await createBuiltGame(), true)
    },
  )
  describe("processTurnsForever", () => {
    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    integrationTest("should process all currently due turns before waiting", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.games.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: secondGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      expect(await player.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should wait before retrying when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // No turns were processed because turns in error block, this will be resolved by https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/278
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })
  })

  describe("processNextDueTurn", () => {
    integrationTest("should process the current turn and queue the next one", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, GainInfluence.id),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const repeatedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        turn: 2,
        turnEndsAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        resources: createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 8, total: 8 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
        actions: expect.any(Array),
      })
      expect(playerView.actions.map(({ id }) => id)).toStrictEqual(initialPlayerView.actions.map(({ id }) => id))
      expect(playerView.actions.every(({ selectedTargets }) => selectedTargets === null)).toBe(true)
      expect(repeatedPlayerView.actions).toStrictEqual(playerView.actions)
    })

    integrationTest("should process multiple submitted actions", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      for (const actionDefinitionId of [GainFuel.id, GainMetal.id]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, actionDefinitionId),
        })
      }

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
        turn: 2,
        resources: createResourcesDtoStub({
          [ResourceType.METAL]: { uncommitted: 5, total: 5 },
          [ResourceType.FUEL]: { uncommitted: 6, total: 6 },
        }),
      })
    })

    integrationTest("should process actions that build fleets", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // Create the game
      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      // Start the game
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      const homePlanet = initialPlayerView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)

      // Build a fleet
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: { actionId: buildFleet.id, selectedTargets: { planet: homePlanet.id }, selectedInputs: {} },
      })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(initialPlayerView.fleets).toStrictEqual([])
      expect(playerView.fleets).toStrictEqual([
        {
          id: expect.any(String), // this is deterministic, but we cannot control the initial game rng state
          ownerPlayerId: player.account.id,
          name: expect.any(String), // this is deterministic, but we cannot control the initial game rng state
          strength: 10,
          originPlanetId: homePlanet.id,
        },
      ])
    })

    integrationTest("should persist a fleet in transit and land it after another turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(origin)
      // With seed 1234, this planet is about 1.146 light years from the home planet.
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(destination)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Earn enough resources to build a fleet and refine its fuel next turn.
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
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const fleet = builtView.fleets[0]
      Assert.isDefined(fleet)
      expect(builtView.fleets).toHaveLength(1)
      expect(fleet).toMatchObject({ ownerPlayerId: player.account.id, originPlanetId: origin.id, strength: 10 })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetImproved.id,
          {
            fleet: fleet.id,
            planet: destination.id,
          },
          { strength: fleet.strength },
        ),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const firstTurnResult = await turnProcessor.processNextDueTurn()
      const inTransitView = await player.client.gameplay.getPlayerView.query({ gameId })
      const journey = inTransitView.fleets[0]
      Assert.isDefined(journey)

      const inTransitAction = inTransitView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(inTransitAction)
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
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const secondTurnResult = await turnProcessor.processNextDueTurn()
      const landedView = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
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
    })

    integrationTest("should persist one movement payment through two no-submission continuations", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(SlowContinuationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: SlowContinuationRuleset.id,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      expect(Math.hypot(destination.x - origin.x, destination.y - origin.y)).toBeCloseTo(1.1456435045942517, 12)

      const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetImproved.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(initialView, BuildFleetImproved.id, { planet: origin.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const moveAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(moveAction)
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
      const departedView = await player.client.gameplay.getPlayerView.query({ gameId })
      // Assert
      const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
      const remainder = departedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)
      Assert.isDefined(journey)
      Assert.isDefined(remainder)
      const expectedMovementProvenance = {
        speed: 0.5,
        departureTurn: builtView.turn,
        submission: {
          id: moveAction.id,
          playerId: builtView.player.id,
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 20 },
        },
        pendingArrivalEffects: [],
      }
      const expectedResourcesAfterPayment = {
        [ResourceType.INFLUENCE]: { total: 91, uncommitted: 91 },
        [ResourceType.METAL]: { total: 97, uncommitted: 97 },
        [ResourceType.FUEL]: { total: 99, uncommitted: 99 },
        [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
        [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
      }
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

      // No submissions are made in either continuation turn; each reload reads the saved journey.
      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const continuedView = await player.client.gameplay.getPlayerView.query({ gameId })
      const continuedJourney = continuedView.fleets.find(({ id }) => id === journey.id)
      Assert.isDefined(continuedJourney)
      // Assert
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
    })

    integrationTest("should leave persisted game state unchanged when a journey has a corrupt movement binding", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(SlowContinuationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: SlowContinuationRuleset.id,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetImproved.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: buildAction.id, selectedTargets: { planet: origin.id }, selectedInputs: {} },
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const moveAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(moveAction)
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
      const departedView = await player.client.gameplay.getPlayerView.query({ gameId })
      const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
      Assert.isDefined(journey)
      Assert.isDefined(journey.movement)
      const corruptedMovement = structuredClone(journey.movement)
      const incorrectStrength = journey.strength - 1
      expect(incorrectStrength).toBeGreaterThan(0)
      Assert.isTrue(Reflect.set(corruptedMovement.submission.selectedInputs, "strength", incorrectStrength))
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
    })

    integrationTest("should allow a second pooled movement Action while the first instance is in progress", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(MultiInstanceTestRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      const quickDestination = planets.find(({ coordinates }) => coordinates === "45:98:25")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      Assert.isDefined(quickDestination)
      expect(quickDestination.id).not.toBe(origin.id)
      expect(Math.hypot(quickDestination.x - origin.x, quickDestination.y - origin.y)).toBeLessThan(1)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Build to strength 50 through normal submissions; each same-planet build reinforces the stationary Fleet.
      let fleetView = initialView
      for (let count = 0; count < 5; count += 1) {
        const buildAction = fleetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
        Assert.isDefined(buildAction)
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: fleetView.turn,
          submittedActionTargets: {
            actionId: buildAction.id,
            selectedTargets: { planet: origin.id },
            selectedInputs: {},
          },
        })
        clock.increment({ time: turnInterval })
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        fleetView = await player.client.gameplay.getPlayerView.query({ gameId })
      }
      expect(fleetView.fleets).toHaveLength(1)
      const sourceFleet = fleetView.fleets[0]
      const firstMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
      const secondMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
      const thirdMove = fleetView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
      const immediateMove = fleetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(firstMove)
      Assert.isDefined(secondMove)
      Assert.isDefined(thirdMove)
      Assert.isDefined(immediateMove)
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
      const inTransitView = await player.client.gameplay.getPlayerView.query({ gameId })
      const firstOccupied = inTransitView.actions.find(({ id }) => id === firstMove.id)
      const secondOccupied = inTransitView.actions.find(({ id }) => id === secondMove.id)
      const freeThird = inTransitView.actions.find(({ id }) => id === thirdMove.id)
      const stationaryRemainder = inTransitView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)
      const otherStationaryFleet = inTransitView.fleets.find(({ id, movement }) => id !== sourceFleet.id && movement === undefined)
      Assert.isDefined(firstOccupied)
      Assert.isDefined(secondOccupied)
      Assert.isDefined(freeThird)
      Assert.isDefined(stationaryRemainder)
      Assert.isDefined(otherStationaryFleet)
      expect(stationaryRemainder).toMatchObject({ strength: 14, originPlanetId: origin.id })
      expect(otherStationaryFleet).toMatchObject({ strength: 1, originPlanetId: quickDestination.id })
      expect(otherStationaryFleet.id).not.toBe(stationaryRemainder.id)
      expect(inTransitView.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([
        1, 14, 15, 20,
      ])
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
      const beforeOccupiedRedirect = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(beforeOccupiedRedirect).toStrictEqual(inTransitView)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: inTransitView.turn,
          submittedActionTargets: {
            actionId: firstOccupied.id,
            selectedTargets: { fleet: otherStationaryFleet.id, planet: origin.id },
            selectedInputs: { strength: 1 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOccupiedRedirect)

      // The third instance remains available while the first two are occupied and cannot select an in-flight child.
      const journeyFleet = inTransitView.fleets.find(({ movement }) => movement !== undefined)
      Assert.isDefined(journeyFleet)
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
    })

    integrationTest("should merge an arriving fleet with the player's fleet at the destination in one turn", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
      const homePlanet = planets.find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)
      // This planet shares the home system, so an improved move takes one turn.
      const nearbyPlanet = planets.find(({ coordinates }) => coordinates === "45:98:25")
      Assert.isDefined(nearbyPlanet)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

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
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const movingFleet = builtView.fleets[0]
      Assert.isDefined(movingFleet)
      expect(builtView.fleets).toHaveLength(1)

      // Move the first fleet away, then build a second fleet at home.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          builtView,
          MoveFleetImproved.id,
          {
            fleet: movingFleet.id,
            planet: nearbyPlanet.id,
          },
          { strength: movingFleet.strength },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const awayView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(awayView.fleets).toHaveLength(1)
      const departedFleet = awayView.fleets[0]
      Assert.isDefined(departedFleet)
      expect(departedFleet).toMatchObject({ originPlanetId: nearbyPlanet.id, strength: movingFleet.strength })
      expect(departedFleet.id).not.toBe(movingFleet.id)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: awayView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(awayView, BuildFleetStandard.id, { planet: homePlanet.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const returnView = await player.client.gameplay.getPlayerView.query({ gameId })
      const stationedFleet = returnView.fleets.find(({ originPlanetId }) => originPlanetId === homePlanet.id)
      Assert.isDefined(stationedFleet)
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
    })

    integrationTest("should persist an ordinary arrival separately from an enemy fleet at the destination", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(EnemyArrivalRuleset))
      using apiServer = new ApiServer(apiServices)
      const attacker = await apiServer.createClient({ authenticated: true })
      const defender = await apiServer.createClient({ authenticated: true })
      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await attacker.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: EnemyArrivalRuleset.id,
          nbSeats: 2,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
          mapGenerationSeed: 1234,
        }),
      })
      await defender.client.games.join.mutate({ gameId })
      await attacker.client.games.startGame.mutate({ gameId })
      const attackerInitialView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderInitialView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const planets = attackerInitialView.galaxy.systems.flatMap(({ planets }) => planets)
      const attackerPlayerId = branded<PlayerId>(attacker.account.id)
      const defenderPlayerId = branded<PlayerId>(defender.account.id)
      const attackerHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defenderHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      Assert.isDefined(attackerHome)
      Assert.isDefined(defenderHome)
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(attackerInitialView, BuildFleetStandard.id, { planet: attackerHome.id }),
      })
      await defender.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: defenderInitialView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(defenderInitialView, BuildFleetImproved.id, { planet: defenderHome.id }),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const attackerBuiltView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const defenderBuiltView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const attackingFleet = attackerBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === attackerPlayerId)
      const defendingFleet = defenderBuiltView.fleets.find(({ ownerPlayerId }) => ownerPlayerId === defenderPlayerId)
      const moveAction = attackerBuiltView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      Assert.isDefined(attackingFleet)
      Assert.isDefined(defendingFleet)
      Assert.isDefined(moveAction)
      expect(attackingFleet).toMatchObject({ strength: 20, originPlanetId: attackerHome.id })
      expect(defendingFleet).toMatchObject({ strength: 7, originPlanetId: defenderHome.id })

      // Act: the public API accepts a normal move; the worker processes its immediate arrival.
      await attacker.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: attackerBuiltView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          attackerBuiltView,
          MoveFleetStandard.id,
          { fleet: attackingFleet.id, planet: defenderHome.id },
          { strength: 20 },
        ),
      })
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")

      // Assert: the reloaded public view retains the enemy row unchanged and the arriving force separately.
      const resolvedView = await attacker.client.gameplay.getPlayerView.query({ gameId })
      const persistedDefenderHome = resolvedView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === defenderHome.id)
      const persistedEnemyFleet = resolvedView.fleets.find(({ id }) => id === defendingFleet.id)
      const persistedArrival = resolvedView.fleets.find(
        ({ ownerPlayerId, id }) => ownerPlayerId === attackerPlayerId && id !== attackingFleet.id,
      )
      Assert.isDefined(persistedEnemyFleet)
      Assert.isDefined(persistedArrival)
      Assert.isDefined(persistedDefenderHome)
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
    })

    integrationTest.for([
      { turnInterval: Time.create(100, UnitOfTime.SECONDS), timeIncrement: Time.create(116, UnitOfTime.SECONDS) },
      { turnInterval: Time.create(100, UnitOfTime.MINUTES), timeIncrement: Time.create(103, UnitOfTime.MINUTES) },
    ])(
      "should schedule the next turn from the current time when the delay exceeds 15 percent of the interval, capped at 2 minutes",
      async ({ turnInterval, timeIncrement }, { db }) => {
        // Arrange
        const clock = new ControlledClock()
        using apiServer = new ApiServer(await createApiStub({ db, clock }))
        const player = await apiServer.createClient({ authenticated: true })

        const { createdGameId } = await player.client.games.create.mutate({
          configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
        })
        await player.client.games.startGame.mutate({ gameId: createdGameId })

        const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

        // Act
        clock.increment({ time: timeIncrement })
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
        await turnProcessor.processNextDueTurn()

        // Assert
        expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
          turn: 2,
          turnEndsAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        })
      },
    )

    integrationTest("should fail the turn when a locked action submission is no longer affordable", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(initialPlayerView, GainMetal.id),
      })
      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: branded(player.account.id),
          resourceType: ResourceType.INFLUENCE,
          amountDelta: -3,
        }),
      )

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const result = await turnProcessor.processNextDueTurn()

      // Assert
      expect(result).toBe("failed")
    })

    integrationTest("should process only the earliest scheduled turn in one invocation", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // later game
      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process the same turn over time", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 3,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should skip turns that are already processing", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      const processingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: processingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(processingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: processingGameId })

      // Act
      clock.increment({ time: processingTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const processingResults = await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(processingResults).toStrictEqual<typeof processingResults>(["processed", "idle"])
      expect(await player.client.gameplay.getPlayerView.query({ gameId: processingGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should not process another turn when the selected turn processing fails", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const failingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      clock.increment({ time: successfulTurnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should be able to process turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: laterTurnInterval })

      // if rows are locked correctly, processing 2 turns concurrently should result in 2 different turns being processed
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should do nothing if there are no turns left when processing turns in parallel", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      // if rows are locked correctly, processing 2 turns concurrently should result in 1 turn being processed and the other one will do nothing
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 } },
      })
    })

    integrationTest("should fully process every player and select at most one deterministic winner", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await joiner.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      for (const { player, amountDelta } of [
        { player: creator, amountDelta: 10 },
        { player: joiner, amountDelta: 12 },
      ]) {
        for (const resourceType of [ResourceType.INFLUENCE, ResourceType.METAL, ResourceType.FUEL, ResourceType.ENERGY]) {
          const updateResourceResult = await resourcesRepository.updateResource({
            gameId: createdGameId,
            playerId: branded(player.account.id),
            resourceType,
            amountDelta,
          })
          Assert.isSuccess(updateResourceResult)
        }
        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: 1,
          submittedActionTargets: getActionToSubmintegrationTest(playerView, WinTheGame.id),
        })
      }

      const creatorViewBeforeProcessing = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const joinerViewBeforeProcessing = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
      const expectedWinnerId = [creator.account.id, joiner.account.id].sort()[0]
      const postSpendAffordability = {
        [GainInfluence.id]: true,
        [WinTheGame.id]: false,
        [GainEnergy.id]: true,
        [GainFuel.id]: true,
        [GainMetal.id]: true,
        [BuildFleetStandard.id]: true,
        [BuildFleetImproved.id]: false,
        [BuildFleetExceptional.id]: false,
        [MoveFleetStandard.id]: true,
        [MoveFleetImproved.id]: true,
        [MoveFleetExceptional.id]: true,
        [AttackMoveTest.id]: false,
        [FlexibleAssaultTest.id]: false,
        [StationaryAssaultTest.id]: true,
        [ColonizeHereTest.id]: false,
        [ColonizePlanetTest.id]: false,
      }
      const joinerPostSpendAffordability = { ...postSpendAffordability, [AttackMoveTest.id]: true }

      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby).toMatchObject({
        winnerAccountId: expectedWinnerId,
        endedAt: expect.any(String),
      })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(creatorView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
        },
        actions: creatorViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: postSpendAffordability[action.actionDefinitionId],
        })),
      })

      const joinerView = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        turn: 1,
        turnStatus: "COMPLETED",
        resources: {
          [ResourceType.INFLUENCE]: { total: 5, uncommitted: 5 },
        },
        actions: joinerViewBeforeProcessing.actions.map((action) => ({
          ...action,
          canAfford: joinerPostSpendAffordability[action.actionDefinitionId],
        })),
      })
    })

    integrationTest("should not do anything in case of failure", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: getActionToSubmintegrationTest(playerView, GainInfluence.id),
      })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId: createdGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })
      const turnToProcess = { gameId: createdGameId, turn: 1 }

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const failedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterFailedSave = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      turnsRepository.shouldFail = false
      await turnsRepository.resetProcessingAttempt(turnToProcess)
      const retriedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterRetry = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(failedProcessingResult).toBe("failed")
      expect(playerViewAfterFailedSave).toMatchObject({
        turn: 1,
        resources: {
          [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
        },
      })
      expect(retriedProcessingResult).toBe("processed")
      expect(playerViewAfterRetry).toMatchObject({
        turn: 2,
        resources: {
          [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 },
        },
      })
    })
  })
})

const SpeedTwoAssaultWorkerTest = typedParse(ActionDefinitionSchema, {
  ...FlexibleAssaultTest,
  id: "TEST_SPEED_TWO_ASSAULT",
  name: "Worker Speed Two Assault",
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
})

const ChargedStationaryAssaultWorkerTest = typedParse(ActionDefinitionSchema, {
  ...StationaryAssaultTest,
  id: "TEST_CHARGED_STATIONARY_ASSAULT",
  name: "Charged Stationary Assault",
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 5, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 1, resourceType: ResourceType.FUEL }),
  ],
})

const TickFiveAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_FIVE_ATTACK_MOVE",
  name: "Tick Five Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 20 } } : effect,
  ),
})
const TickTenAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_TEN_ATTACK_MOVE",
  name: "Tick Ten Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 9.5 } } : effect,
  ),
})
const TickFifteenAttackMoveWorkerTest = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_TICK_FIFTEEN_ATTACK_MOVE",
  name: "Tick Fifteen Assault",
  effects: AttackMoveTest.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 6 } } : effect,
  ),
})

const AssaultWorkerRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_assault_worker_round_trip",
  name: "Test Assault Worker Round Trip",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [FlexibleAssaultTest.id]: FlexibleAssaultTest,
    [SpeedTwoAssaultWorkerTest.id]: SpeedTwoAssaultWorkerTest,
    [ChargedStationaryAssaultWorkerTest.id]: ChargedStationaryAssaultWorkerTest,
    [TickFiveAttackMoveWorkerTest.id]: TickFiveAttackMoveWorkerTest,
    [TickTenAttackMoveWorkerTest.id]: TickTenAttackMoveWorkerTest,
    [TickFifteenAttackMoveWorkerTest.id]: TickFifteenAttackMoveWorkerTest,
  },
  actionPool: [
    ...TestRuleset.actionPool.filter(({ id }) => id !== "TEST_SPEED_TWO_ASSAULT_1"),
    { id: "TEST_SPEED_TWO_ASSAULT_1", actionDefinitionId: SpeedTwoAssaultWorkerTest.id },
    { id: "TEST_CHARGED_STATIONARY_ASSAULT_1", actionDefinitionId: ChargedStationaryAssaultWorkerTest.id },
    { id: "TEST_TICK_FIVE_ATTACK_MOVE_1", actionDefinitionId: TickFiveAttackMoveWorkerTest.id },
    { id: "TEST_TICK_TEN_ATTACK_MOVE_1", actionDefinitionId: TickTenAttackMoveWorkerTest.id },
    { id: "TEST_TICK_FIFTEEN_ATTACK_MOVE_1", actionDefinitionId: TickFifteenAttackMoveWorkerTest.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})
const HomeArrivalMergeRuleset = Ruleset.create({
  ...AssaultWorkerRuleset,
  id: "test_home_arrival_merge_worker",
  name: "Test Home Arrival Merge Worker",
  actionPool: [...AssaultWorkerRuleset.actionPool, { id: "TEST_ATTACK_MOVE_2", actionDefinitionId: AttackMoveTest.id }],
})
const WorkerI207Ruleset = Ruleset.create({
  ...AssaultWorkerRuleset,
  id: "test_i207_worker_controls",
  name: "Test I2-07 Worker Controls",
  actionPool: [...AssaultWorkerRuleset.actionPool, { id: `${MoveFleetExceptional.id}_2`, actionDefinitionId: MoveFleetExceptional.id }],
})

const MultiInstanceTestRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

const SlowMoveFleetStandard = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  effects: MoveFleetStandard.effects.map((effect) =>
    effect.type === FleetMoveEffectDefinition.type ? { ...effect, parameters: { ...effect.parameters, speed: 0.5 } } : effect,
  ),
})

const SlowContinuationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_slow_continuation_payment",
  name: "Slow Continuation Payment Test",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [SlowMoveFleetStandard.id]: SlowMoveFleetStandard },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

const WorkerEnemyArrivalBuildStandard = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 20 })],
})
const WorkerEnemyArrivalBuildImproved = typedParse(ActionDefinitionSchema, {
  ...BuildFleetImproved,
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 7 })],
})
const WorkerEnemyArrivalMoveStandard = typedParse(ActionDefinitionSchema, {
  ...MoveFleetStandard,
  targets: {
    ...MoveFleetStandard.targets,
    [branded<TargetTag>("planet")]: {
      ...MoveFleetStandard.targets[branded<TargetTag>("planet")],
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance: 100_000 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
      ],
    },
  },
  effects: [FleetMoveEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet", strengthTag: "strength", speed: 100_000 })],
})

const EnemyArrivalRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_worker_enemy_arrival",
  name: "Worker Enemy Arrival Test",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [WorkerEnemyArrivalBuildStandard.id]: WorkerEnemyArrivalBuildStandard,
    [WorkerEnemyArrivalBuildImproved.id]: WorkerEnemyArrivalBuildImproved,
    [WorkerEnemyArrivalMoveStandard.id]: WorkerEnemyArrivalMoveStandard,
  },
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

type PublicHomeArrivalFixture = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  playerIds: readonly [PlayerId, PlayerId]
  gameId: number
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  aliceHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  bobHome: PlayerView["galaxy"]["systems"][number]["planets"][number]
  aliceAtSource: PlayerView["fleets"][number] | undefined
  aliceAtTarget: PlayerView["fleets"][number] | undefined
  bobAtSource: PlayerView["fleets"][number] | undefined
  bobAtTarget: PlayerView["fleets"][number] | undefined
  distance: number
}

async function createPublicHomeArrivalFixture({
  db,
  clock,
  apiServer,
  ruleset,
  aliceDepartureStrength,
  bobDepartureStrength,
  bobStartingStrength = bobDepartureStrength,
}: {
  db: Database
  clock: ControlledClock
  apiServer: ApiServer
  ruleset: Ruleset
  aliceDepartureStrength: number
  bobDepartureStrength: number
  bobStartingStrength?: number
}): Promise<PublicHomeArrivalFixture> {
  // Arrange: establish the fixed seed-147 home pair through the public game lifecycle.
  const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const clients = [alice, bob] as const
  const playerIds = [branded<PlayerId>(alice.account.id), branded<PlayerId>(bob.account.id)] as const
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: ruleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[0])
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerIds[1])
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)
  expect({
    aliceHome: { id: aliceHome.id, name: aliceHome.name, coordinates: aliceHome.coordinates },
    bobHome: { id: bobHome.id, name: bobHome.name, coordinates: bobHome.coordinates },
    distance: Math.hypot(aliceHome.x - bobHome.x, aliceHome.y - bobHome.y),
  }).toStrictEqual({
    aliceHome: { id: "57c1b320-c267-5c9b-a5a5-1b5a02823714", name: "planet 552840", coordinates: "45:83:40" },
    bobHome: { id: "ec56a9af-3995-521c-822d-84685a96fdc6", name: "planet 819299", coordinates: "44:98:05" },
    distance: 4.418312565270031,
  })

  // Arrange: use public Build submissions and real worker turns to create Alice40 and Bob's requested defender force.
  const bobBuildRounds = Math.ceil(Math.max(bobDepartureStrength, bobStartingStrength) / 10)
  for (let buildRound = 0; buildRound < Math.max(4, bobBuildRounds); buildRound += 1) {
    const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    const aliceView = views[0]
    const bobView = views[1]
    Assert.isDefined(aliceView)
    Assert.isDefined(bobView)
    if (buildRound < 4) {
      await alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: aliceView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(aliceView, BuildFleetStandard.id, { planet: aliceHome.id }),
      })
    }
    if (buildRound < bobBuildRounds) {
      await bob.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: bobView.turn,
        submittedActionTargets: getActionToSubmintegrationTest(bobView, BuildFleetStandard.id, { planet: bobHome.id }),
      })
    }
    await processPublicTurn({ clients, gameId, turn: aliceView.turn, turnProcessor })
  }
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceBuilt = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === aliceHome.id && movement === undefined,
  )
  const bobBuilt = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
  )
  Assert.isDefined(aliceBuilt)
  Assert.isDefined(bobBuilt)
  expect(aliceBuilt.strength).toBe(40)
  expect(bobBuilt.strength).toBe(Math.ceil(Math.max(bobDepartureStrength, bobStartingStrength) / 10) * 10)

  // Act: stage Alice's source at Bob's home and Bob's defending force at Alice's home with public exceptional Moves.
  const departureViews = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
  const aliceDepartureView = departureViews[0]
  const bobDepartureView = departureViews[1]
  Assert.isDefined(aliceDepartureView)
  Assert.isDefined(bobDepartureView)
  if (aliceDepartureStrength > 0) {
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: aliceDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        aliceDepartureView,
        MoveFleetExceptional.id,
        { fleet: aliceBuilt.id, planet: bobHome.id },
        { strength: aliceDepartureStrength },
      ),
    })
  }
  if (bobDepartureStrength > 0) {
    await bob.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: bobDepartureView.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        bobDepartureView,
        MoveFleetExceptional.id,
        { fleet: bobBuilt.id, planet: aliceHome.id },
        { strength: bobDepartureStrength },
      ),
    })
  }
  await processPublicTurn({ clients, gameId, turn: aliceDepartureView.turn, turnProcessor })
  const stagedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const aliceAtSource = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === bobHome.id && movement === undefined,
  )
  const aliceAtTarget = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[0] && originPlanetId === aliceHome.id && movement === undefined,
  )
  const bobAtSource = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === bobHome.id && movement === undefined,
  )
  const bobAtTarget = stagedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === playerIds[1] && originPlanetId === aliceHome.id && movement === undefined,
  )
  if (aliceDepartureStrength === 0) {
    expect(aliceAtSource).toBeUndefined()
    expect(aliceAtTarget).toMatchObject({ strength: 40 })
  } else {
    Assert.isDefined(aliceAtSource)
    expect(aliceAtSource.strength).toBe(aliceDepartureStrength)
    if (aliceDepartureStrength === 40) {
      expect(aliceAtTarget).toBeUndefined()
    } else {
      expect(aliceAtTarget?.strength).toBe(40 - aliceDepartureStrength)
    }
  }
  Assert.isDefined(bobAtTarget)
  expect(bobAtTarget.strength).toBe(bobDepartureStrength)
  if (bobStartingStrength > bobDepartureStrength) {
    Assert.isDefined(bobAtSource)
    expect(bobAtSource.strength).toBe(Math.ceil(bobStartingStrength / 10) * 10 - bobDepartureStrength)
  }
  return {
    clients,
    playerIds,
    gameId,
    turnProcessor,
    turnsRepository,
    aliceHome,
    bobHome,
    aliceAtSource,
    aliceAtTarget,
    bobAtSource,
    bobAtTarget,
    distance: 4.418312565270031,
  }
}
type PublicAssaultStagingFixture = {
  clients: AuthenticatedApiClient[]
  playerIds: PlayerId[]
  gameId: number
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  stagingPlanet: PlayerView["galaxy"]["systems"][number]["planets"][number]
  homes: Array<PlayerView["galaxy"]["systems"][number]["planets"][number]>
  stationed: Array<PlayerView["fleets"][number]>
}

async function createPublicAssaultStagingFixture({
  apiServer: _apiServer,
  clients: availableClients,
  forces,
  stagingCoordinates,
  targetOwnerFirst,
  turnProcessor,
  expectedRouteDistances,
  ruleset,
  stagePlayerIndices,
}: {
  apiServer: ApiServer
  clients: readonly AuthenticatedApiClient[]
  forces: readonly number[]
  stagingCoordinates: string
  targetOwnerFirst: boolean
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  expectedRouteDistances: readonly number[]
  ruleset?: Ruleset
  stagePlayerIndices?: readonly number[]
}): Promise<PublicAssaultStagingFixture> {
  // Arrange: create/join/start a fresh fixed-seed game exclusively through the public API.
  const initialClients = availableClients.slice(0, forces.length)
  const gameRuleset = ruleset ?? AssaultWorkerRuleset
  const playersToStage = stagePlayerIndices ?? forces.map((_, index) => index)
  const host = initialClients[0]
  Assert.isDefined(host)
  const { createdGameId: gameId } = await host.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: gameRuleset.id,
      nbSeats: forces.length,
      turnIntervalSeconds: Time.in(Time.create(10, UnitOfTime.SECONDS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  for (const joiningClient of initialClients.slice(1)) {
    await joiningClient.client.games.join.mutate({ gameId })
  }
  await host.client.games.startGame.mutate({ gameId })
  const initialView = await host.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const stagingPlanet = planets.find(({ coordinates }) => coordinates === stagingCoordinates)
  Assert.isDefined(stagingPlanet)

  // Arrange: role A owns the fixed target for two-seat stationary controls; three-seat roles retain caller order.
  let roleClients = [...initialClients]
  if (targetOwnerFirst) {
    const ownerIndex = initialClients.findIndex(({ account }) => String(account.id) === String(stagingPlanet.ownerPlayerId))
    expect(ownerIndex).toBeGreaterThanOrEqual(0)
    const ownerClient = initialClients[ownerIndex]
    Assert.isDefined(ownerClient)
    roleClients = [ownerClient, ...initialClients.filter((_, index) => index !== ownerIndex)]
  }
  const playerIds = roleClients.map(({ account }) => branded<PlayerId>(account.id))
  const homes = playerIds.map((playerId) => {
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerId)
    Assert.isDefined(home)
    return home
  })
  const routeDistances = homes.map((home) => Math.hypot(home.x - stagingPlanet.x, home.y - stagingPlanet.y))
  expect(routeDistances).toStrictEqual([...expectedRouteDistances])

  // Arrange: build each requested force through actual public Build submissions and worker turns.
  const buildRounds = Math.max(...forces.map((strength) => Math.ceil(strength / 10)))
  for (let buildRound = 0; buildRound < buildRounds; buildRound += 1) {
    const views = await Promise.all(roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    for (let roleIndex = 0; roleIndex < roleClients.length; roleIndex += 1) {
      const client = roleClients[roleIndex]
      const view = views[roleIndex]
      const home = homes[roleIndex]
      const force = forces[roleIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      Assert.isDefined(force)
      if (buildRound < Math.ceil(force / 10)) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ clients: roleClients, gameId, turn: view.turn, turnProcessor })
  }
  const builtView = await roleClients[0]?.client.gameplay.getPlayerView.query({ gameId })
  Assert.isDefined(builtView)
  const builtFleets = homes.map((home, roleIndex) => {
    const playerId = playerIds[roleIndex]
    Assert.isDefined(playerId)
    const fleet = builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement === undefined,
    )
    Assert.isDefined(fleet)
    return fleet
  })
  expect(builtFleets.map(({ strength }) => strength)).toStrictEqual(forces.map((strength) => Math.ceil(strength / 10) * 10))

  // Act: stage each role's literal selected force at the named public planet through ordinary Move submissions.
  const departureViews = await Promise.all(roleClients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
  for (let roleIndex = 0; roleIndex < roleClients.length; roleIndex += 1) {
    if (!playersToStage.includes(roleIndex)) {
      continue
    }
    const client = roleClients[roleIndex]
    const view = departureViews[roleIndex]
    const home = homes[roleIndex]
    const fleet = builtFleets[roleIndex]
    const force = forces[roleIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    Assert.isDefined(fleet)
    Assert.isDefined(force)
    if (home.id !== stagingPlanet.id) {
      await client.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: getActionToSubmintegrationTest(
          view,
          MoveFleetExceptional.id,
          { fleet: fleet.id, planet: stagingPlanet.id },
          { strength: force },
        ),
      })
    }
  }
  let stagingView = departureViews[0]
  Assert.isDefined(stagingView)
  await processPublicTurn({ clients: roleClients, gameId, turn: stagingView.turn, turnProcessor })
  const firstAdvanceClient = roleClients[0]
  Assert.isDefined(firstAdvanceClient)
  stagingView = await firstAdvanceClient.client.gameplay.getPlayerView.query({ gameId })
  for (let advance = 0; advance < 6; advance += 1) {
    const pendingArrivals = stagingView.fleets.filter(
      ({ ownerPlayerId, destinationPlanetId, movement }) =>
        playerIds.includes(ownerPlayerId) && destinationPlanetId === stagingPlanet.id && movement !== undefined,
    )
    if (pendingArrivals.length === 0) {
      break
    }
    await processPublicTurn({ clients: roleClients, gameId, turn: stagingView.turn, turnProcessor })
    const currentClient = roleClients[0]
    Assert.isDefined(currentClient)
    stagingView = await currentClient.client.gameplay.getPlayerView.query({ gameId })
  }
  expect(
    stagingView.fleets.some(
      ({ ownerPlayerId, destinationPlanetId, movement }) =>
        playerIds.includes(ownerPlayerId) && destinationPlanetId === stagingPlanet.id && movement !== undefined,
    ),
  ).toBe(false)
  const stationed = playerIds.map((playerId, roleIndex) => {
    const home = homes[roleIndex]
    Assert.isDefined(home)
    const location = playersToStage.includes(roleIndex) ? stagingPlanet : home
    const fleet = stagingView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === playerId && originPlanetId === location.id && movement === undefined,
    )
    Assert.isDefined(fleet)
    expect(fleet.strength).toBe(forces[roleIndex])
    return fleet
  })

  return { clients: roleClients, playerIds, gameId, turnProcessor, stagingPlanet, homes, stationed }
}
type ThreeOwnerStationedAssaultFixture = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  gameId: number
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
  target: PlayerView["galaxy"]["systems"][number]["planets"][number]
  homes: readonly [
    PlayerView["galaxy"]["systems"][number]["planets"][number],
    PlayerView["galaxy"]["systems"][number]["planets"][number],
    PlayerView["galaxy"]["systems"][number]["planets"][number],
  ]
  stationed: readonly [PlayerView["fleets"][number], PlayerView["fleets"][number], PlayerView["fleets"][number]]
}

async function createThreeOwnerStationedAssaultFixture({
  db,
  clock,
  apiServer,
}: {
  db: Database
  clock: ControlledClock
  apiServer: ApiServer
}): Promise<ThreeOwnerStationedAssaultFixture> {
  const alice = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const carol = await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" })
  const clients = [alice, bob, carol] as const
  const playerAId = branded<PlayerId>(alice.account.id)
  const playerBId = branded<PlayerId>(bob.account.id)
  const playerCId = branded<PlayerId>(carol.account.id)
  const playerIds = [playerAId, playerBId, playerCId] as const
  const turnInterval = Time.create(10, UnitOfTime.SECONDS)
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: AssaultWorkerRuleset.id,
      nbSeats: 3,
      turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await carol.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  const homeA = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerAId)
  const homeB = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerBId)
  const homeC = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerCId)
  Assert.isDefined(homeA)
  Assert.isDefined(homeB)
  Assert.isDefined(homeC)
  const homes = [homeA, homeB, homeC] as const
  const routeDistances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))
  expect({
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    homes: homes.map((home, index) => ({
      playerId: playerIds[index],
      id: home.id,
      name: home.name,
      coordinates: home.coordinates,
      x: home.x,
      y: home.y,
      distance: routeDistances[index],
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
        id: "f92f944d-b247-52fa-ab94-58627375cd87",
        name: "planet 872951",
        coordinates: "54:28:25",
        x: 48.103346707667825,
        y: 52.401269727867565,
        distance: 6.340414101122655,
      },
      {
        playerId: "00000000-0000-4000-8000-000000000002",
        id: "ba9892e3-c082-59b5-a22d-0acf87b77b58",
        name: "planet 53347",
        coordinates: "46:95:40",
        x: 65.3540419094844,
        y: 49.983856636309184,
        distance: 12.182152625782757,
      },
      {
        playerId: "00000000-0000-4000-8000-000000000003",
        id: "e3099011-2516-5087-9276-8466867a3aaa",
        name: "planet 811151",
        coordinates: "44:36:25",
        x: 46.74290769550233,
        y: 43.95293410516799,
        distance: 8.039286685075407,
      },
    ],
  })

  // Arrange: build literal A30/B20/C10 through public Build submissions and completed actual-worker turns.
  for (let buildRound = 0; buildRound < 3; buildRound += 1) {
    const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const buildCount = ownerIndex === 0 ? 3 : ownerIndex === 1 ? 2 : 1
      const client = clients[ownerIndex]
      const view = views[ownerIndex]
      const home = homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      if (buildRound < buildCount) {
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

  // Assert: public worker builds have independently established force inputs before staging.
  const builtView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const builtFleets = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return builtView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement === undefined,
    )
  })
  const builtFleetA = builtFleets[0]
  const builtFleetB = builtFleets[1]
  const builtFleetC = builtFleets[2]
  Assert.isDefined(builtFleetA)
  Assert.isDefined(builtFleetB)
  Assert.isDefined(builtFleetC)
  expect([builtFleetA.strength, builtFleetB.strength, builtFleetC.strength]).toStrictEqual([30, 20, 10])

  // Act: send each complete force through the public Move action to the fixed common planet.
  for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
    const client = clients[ownerIndex]
    Assert.isDefined(client)
    const view = await client.client.gameplay.getPlayerView.query({ gameId })
    const fleet = builtFleets[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        MoveFleetExceptional.id,
        { fleet: fleet.id, planet: target.id },
        { strength: fleet.strength },
      ),
    })
  }
  const departureView = await alice.client.gameplay.getPlayerView.query({ gameId })
  await processPublicTurn({ clients, gameId, turn: departureView.turn, turnProcessor })
  const firstTransitView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const firstTransit = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return firstTransitView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === home.id && movement !== undefined,
    )
  })
  const transitA = firstTransit[0]
  const transitB = firstTransit[1]
  const transitC = firstTransit[2]
  Assert.isDefined(transitA)
  Assert.isDefined(transitB)
  Assert.isDefined(transitC)
  expect([transitA.distanceToEnd, transitB.distanceToEnd, transitC.distanceToEnd]).toStrictEqual([
    1.3404141011226551, 7.1821526257827575, 3.039286685075407,
  ])

  // Act: reload the two first arrivals while B remains in transit, then resolve B's saved remainder.
  await processPublicTurn({ clients, gameId, turn: firstTransitView.turn, turnProcessor })
  const secondTransitView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const remainingB = secondTransitView.fleets.find(
    ({ ownerPlayerId, movement }) => ownerPlayerId === playerIds[1] && movement !== undefined,
  )
  Assert.isDefined(remainingB)
  expect(remainingB.distanceToEnd).toBe(2.1821526257827575)
  expect(
    secondTransitView.fleets
      .filter(
        ({ ownerPlayerId, originPlanetId, movement }) =>
          [playerIds[0], playerIds[2]].includes(ownerPlayerId) && originPlanetId === target.id && movement === undefined,
      )
      .map(({ ownerPlayerId, strength }) => ({ ownerPlayerId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.ownerPlayerId, second.ownerPlayerId)),
  ).toStrictEqual([
    { ownerPlayerId: playerIds[0], strength: 30 },
    { ownerPlayerId: playerIds[2], strength: 10 },
  ])
  await processPublicTurn({ clients, gameId, turn: secondTransitView.turn, turnProcessor })
  const stationedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  const stationed = homes.map((home, index) => {
    const playerId = playerIds[index]
    Assert.isDefined(playerId)
    return stationedView.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerId && originPlanetId === target.id && movement === undefined,
    )
  })
  const stationedA = stationed[0]
  const stationedB = stationed[1]
  const stationedC = stationed[2]
  Assert.isDefined(stationedA)
  Assert.isDefined(stationedB)
  Assert.isDefined(stationedC)
  expect([stationedA.strength, stationedB.strength, stationedC.strength]).toStrictEqual([30, 20, 10])
  return {
    clients,
    playerIds,
    gameId,
    turnProcessor,
    turnsRepository,
    target,
    homes,
    stationed: [stationedA, stationedB, stationedC] as const,
  }
}
async function processPublicTurn({
  clients,
  gameId,
  turn,
  turnProcessor,
  process = true,
}: {
  clients: readonly AuthenticatedApiClient[]
  gameId: number
  turn: number
  turnProcessor: { processNextDueTurn: () => Promise<"processed" | "idle" | "failed"> }
  process?: boolean
}): Promise<void> {
  await Promise.all(clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })))
  if (process) {
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  }
}

async function observeTurnAndRollback({
  db,
  clock,
  turnsRepository,
  gameId,
  turn,
}: {
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: number
  turn: number
}): Promise<TurnToProcessModel> {
  // Arrange: the public readiness route has closed the requested turn before acquiring the production repository lock.
  let observed: TurnToProcessModel | undefined
  const message = `Intentional I2-06 observation rollback for game ${gameId} turn ${turn}`

  // Act: copy the production-parsed input, then force the same transaction to undo PROCESSING and lock changes.
  await expect(
    db.transaction(async (tx) => {
      const queuedTurn = await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx)
      Assert.isDefined(queuedTurn)
      expect(queuedTurn).toStrictEqual({ gameId, turn })
      observed = structuredClone(await turnsRepository.startTurnProcessing({ turn: queuedTurn, processingStartedAt: clock.now() }, tx))
      throw new TransactionRollbackError(message)
    }),
  ).rejects.toMatchObject({ name: "TransactionRollbackError", message })

  // Assert: the intentional rollback returned the copied, naturally parsed production input.
  Assert.isDefined(observed)
  expect(observed).toMatchObject({ gameId, turn })
  return observed
}

function reverseObjectPropertyOrder<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    for (const nestedValue of value) {
      reverseObjectPropertyOrder(nestedValue)
    }
    return value
  }
  if (
    value === null ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    return value
  }
  const entries = Object.entries(value).map(([key, nestedValue]) => [key, nestedValue] as const)
  for (const [, nestedValue] of entries) {
    reverseObjectPropertyOrder(nestedValue)
  }
  for (const [key] of entries) {
    Reflect.deleteProperty(value, key)
  }
  for (const [key, nestedValue] of entries.toReversed()) {
    Reflect.set(value, key, nestedValue)
  }
  return value
}

function replayObservedTurn(
  observed: TurnToProcessModel,
  reverseRows: boolean,
): { resolved: ResolvedTurnState; rngState: RngState<number> } {
  // Arrange: each replay permutes only copied record keys and row order; semantic arrays retain their ordinals.
  const copiedObserved = structuredClone(observed)
  const input = reverseRows ? reverseObjectPropertyOrder(copiedObserved) : copiedObserved
  const submittedActions = reverseRows ? [...input.submittedActions].toReversed() : [...input.submittedActions]
  const players = indexBy("id", reverseRows ? Object.values(input.players).toReversed() : Object.values(input.players))
  const planets = indexBy("id", reverseRows ? Object.values(input.planets).toReversed() : Object.values(input.planets))
  const fleets = indexBy("id", reverseRows ? Object.values(input.fleets).toReversed() : Object.values(input.fleets))
  const rng = Rng.fromState(input.rngState, mulberry32Prng)

  // Act: the separately labeled shared replay resolves only this copied input and its restored natural generator.
  const resolved = resolveTurn(
    {
      gameId: input.gameId,
      turn: input.turn,
      submittedActions,
      players,
      planets,
      fleets,
      winnerPlayerId: undefined,
    },
    input.ruleset,
    rng,
  )
  Assert.isSuccess(resolved)

  // Assert: return the complete replayed outcomes and resulting RNG state for comparison with persisted observation.
  return { resolved: resolved.value, rngState: rng.getState() }
}

function mulberry32DrawAt(generatorState: number): { value: number; nextGeneratorState: number } {
  // Arrange: derive a draw independently from the installed tools-ts generator.
  const nextGeneratorState = (generatorState + 0x6d2b79f5) >>> 0
  let value = nextGeneratorState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  const draw = ((value ^ (value >>> 14)) >>> 0) / 4294967296
  return { value: draw, nextGeneratorState }
}

function mulberry32FirstDraw(generatorState: number): { value: number; nextGeneratorState: number } {
  // Assert: the independent implementation matches tools-ts at the observed state and the fixed seed-1234 oracle.
  const draw = mulberry32DrawAt(generatorState)
  const toolsOracle = Rng.create(mulberry32Prng(generatorState))
  expect(toolsOracle.float()).toBe(draw.value)
  const seed1234Oracle = Rng.create(mulberry32Prng(1234))
  expect(seed1234Oracle.float()).toBe(0.07329497812315822)
  return draw
}

function mulberry32DrawSequence(
  generatorState: number,
  count: number,
): { draws: Array<{ value: number; nextGeneratorState: number }>; finalGeneratorState: number } {
  const draws: Array<{ value: number; nextGeneratorState: number }> = []
  let nextGeneratorState = generatorState
  const toolsOracle = Rng.create(mulberry32Prng(generatorState))
  for (let index = 0; index < count; index += 1) {
    const draw = mulberry32DrawAt(nextGeneratorState)
    expect(toolsOracle.float()).toBe(draw.value)
    draws.push(draw)
    nextGeneratorState = draw.nextGeneratorState
  }
  return { draws, finalGeneratorState: nextGeneratorState }
}

function normalizedOutcomeSequence(resolved: ResolvedTurnState): Array<{
  playerId: PlayerId
  actionId: string
  outcomes: readonly EffectOutcome[]
}> {
  return resolved.resolvedActions
    .toSorted((first, second) => {
      const ownerOrder = compareOrdinalStrings(first.submittedAction.playerId, second.submittedAction.playerId)
      return ownerOrder === 0 ? compareOrdinalStrings(first.submittedAction.id, second.submittedAction.id) : ownerOrder
    })
    .map(({ submittedAction, actionOutcomes }) => ({
      playerId: submittedAction.playerId,
      actionId: submittedAction.id,
      outcomes: actionOutcomes,
    }))
}

function outcomeForOwner(resolved: ResolvedTurnState, playerId: PlayerId | undefined, actionId?: string): EffectOutcome | undefined {
  if (playerId === undefined) {
    return undefined
  }
  const action = resolved.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === playerId && (actionId === undefined || submittedAction.id === actionId),
  )
  return action?.actionOutcomes.at(-1)
}

function ownerFleetForces(resolved: ResolvedTurnState, playerIds: readonly PlayerId[], planetId?: string): Record<PlayerId, number[]> {
  return Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      Object.values(resolved.fleets)
        .filter(
          ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && (planetId === undefined || originPlanetId === planetId),
        )
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
}

function ownerPublicForces(fleets: PlayerView["fleets"], playerIds: readonly PlayerId[], planetId?: string): Record<PlayerId, number[]> {
  return Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      fleets
        .filter(
          ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && (planetId === undefined || originPlanetId === planetId),
        )
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
}

function getActionToSubmintegrationTest(
  playerView: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]> = {},
  selectedInputs: DeepUnbranded<NonNullable<SubmittedActionTargetsDto["selectedInputs"]>> = {},
): DeepUnbranded<SubmittedActionTargetsDto> {
  const action = playerView.actions.find((availableAction) => availableAction.actionDefinitionId === actionDefinitionId)
  Assert.isDefined(action)
  return {
    actionId: action.id,
    selectedTargets,
    selectedInputs,
  }
}

class FailingTurnsRepository extends TurnsRepository {
  private readonly failingGameId: number

  public shouldFail = true

  public constructor({
    db,
    logger,
    failingGameId,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTurn(processedTurn: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    if (processedTurn.gameId === this.failingGameId && this.shouldFail) {
      return Result.Failure("Expected turn save failure")
    }

    return await super.saveProcessedTurn(processedTurn)
  }
}

function logWorkerObservation(label: string, serializedObservation: string): void {
  Logger.get().info(`${label} ${serializedObservation}`)
}
