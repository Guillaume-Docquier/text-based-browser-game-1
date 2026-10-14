import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { AttackMoveTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { v5 } from "uuid"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  normalizedOutcomeSequence,
  outcomeForOwner,
  ownerFleetForces,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import {
  ChargedStationaryAssaultWorkerTest,
  TickFiveAttackMoveWorkerTest,
  TickTenAttackMoveWorkerTest,
  TickFifteenAttackMoveWorkerTest,
  AssaultWorkerRuleset,
  HomeArrivalMergeRuleset,
  createPublicHomeArrivalFixture,
  createPublicAssaultStagingFixture,
} from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
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

      const verifyIndexPhase1 = async (): Promise<void> => {
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
      }
      await verifyIndexPhase1()

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

      const verifyOwnerPublicForcesPhase2 = (): void => {
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
      }
      verifyOwnerPublicForcesPhase2()

      const emptyTurn = afterViews[0]
      Assert.isDefined(emptyTurn)

      const verifyEmptyObservedPhase3Observed = observed
      const verifyEmptyObservedPhase3 = async (): Promise<void> => {
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
        expect(emptyObserved.rngState).toStrictEqual(verifyEmptyObservedPhase3Observed.rngState)
        logWorkerObservation(
          "[I2-04 public worker]",
          JSON.stringify({
            generatorState: verifyEmptyObservedPhase3Observed.rngState.generatorState,
            draws: [],
            ticks: [5, 15],
            order: [fixture.playerIds[0], fixture.playerIds[1]],
            nextState: emptyObserved.rngState,
          }),
        )
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await verifyEmptyObservedPhase3()
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

      const verifyIndexPhase4 = async (): Promise<void> => {
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
      }
      await verifyIndexPhase4()

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

      const verifyAssertSurvivorState1Phase5 = (): void => {
        const assertSurvivorState1 = (): void => {
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
        }
        assertSurvivorState1()
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
      }
      verifyAssertSurvivorState1Phase5()

      const emptyTurn = afterViews[0]
      Assert.isDefined(emptyTurn)

      const verifyEmptyObservedPhase6Observed = observed
      const verifyEmptyObservedPhase6 = async (): Promise<void> => {
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
        expect(emptyObserved.rngState).toStrictEqual(verifyEmptyObservedPhase6Observed.rngState)
        logWorkerObservation(
          "[I2-05 public worker]",
          JSON.stringify({
            generatorState: verifyEmptyObservedPhase6Observed.rngState.generatorState,
            draws: [],
            ticks: [5, 10, 15],
            outcomes: [10, 16, "Prevented"],
            nextState: emptyObserved.rngState,
          }),
        )
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await verifyEmptyObservedPhase6()
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

    const verifyAssertOutcomeForOwnerState1Phase7Observed = observed
    const verifyAssertOutcomeForOwnerState1Phase7 = async (): Promise<void> => {
      const assertOutcomeForOwnerState1 = async (): Promise<void> => {
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
        expect(forward.rngState).toStrictEqual(verifyAssertOutcomeForOwnerState1Phase7Observed.rngState)
        expect(permuted.rngState).toStrictEqual(verifyAssertOutcomeForOwnerState1Phase7Observed.rngState)

        // Act: the actual worker reloads, applies the departure/no-op, and saves both public rows.
        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await assertOutcomeForOwnerState1()
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
    }
    await verifyAssertOutcomeForOwnerState1Phase7()
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

      const verifySelectedViewPhase8 = async (): Promise<void> => {
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
      }
      await verifySelectedViewPhase8()

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

      const verifyPermutedPhase9Observed = observed
      const verifyPermutedPhase9 = (): void => {
        const permuted = replayObservedTurn(verifyPermutedPhase9Observed, true)
        const expectedTargetForces = { [playerAId]: [22], [playerBId]: [] }
        const assertOwnerFleetForcesState1 = (): void => {
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
        }
        assertOwnerFleetForcesState1()
      }
      verifyPermutedPhase9()

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

      const verifyOwnerIndexPhase10 = (): void => {
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
          expect(view.resources[ResourceType.INFLUENCE].total).toBe(
            before.resources[ResourceType.INFLUENCE].total - aliceBuildInfluenceCost,
          )
          expect(view.resources[ResourceType.METAL].total).toBe(before.resources[ResourceType.METAL].total - aliceBuildMetalCost)
          expect(view.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total)
        }
      }
      verifyOwnerIndexPhase10()

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
})
