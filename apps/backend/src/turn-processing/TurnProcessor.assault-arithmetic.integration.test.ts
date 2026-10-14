import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { Fleet, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  assertSurvivor,
  assertEmptyObserved2,
  assertOutcomeForOwner,
} from "../tests/fleet-assertions/TurnProcessor.assault-arithmetic-2.ts"
import { createEmptyObservedSetup } from "../tests/fleet-assertions/TurnProcessor.assault-arithmetic.stages-2.ts"
import {
  createClientsSetup,
  createEmptyTurnSetup,
  createClientsSetup2,
  createFleetBSetup,
  createFixtureSetup,
  createBuildActionSetup,
} from "../tests/fleet-assertions/TurnProcessor.assault-arithmetic.stages.ts"
import { assertEmptyObserved } from "../tests/fleet-assertions/TurnProcessor.assault-arithmetic.ts"
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
  AssaultWorkerRuleset,
  HomeArrivalMergeRuleset,
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

      const createClientsSetupPhase1Result = await createClientsSetup({ apiServer, db, clock })
      const { fixture, actionIds, forward, firstFleet } = createClientsSetupPhase1Result
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

      const createEmptyTurnSetupPhase2Result = await createEmptyTurnSetup({
        ...createClientsSetupPhase1Result,
        playerAId,
        firstActionId,
        firstFleet,
        playerBId,
        laterActionId,
        laterFleet,
        firstOutcome,
        laterOutcome,
      })

      await assertEmptyObserved({ ...createClientsSetupPhase1Result, ...createEmptyTurnSetupPhase2Result, db, clock })
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

      const createClientsSetupPhase3Result = await createClientsSetup2({ apiServer, db, clock })
      const { fixture, target, observed, forward } = createClientsSetupPhase3Result

      const createFleetBSetupPhase4Result = await createFleetBSetup({ ...createClientsSetupPhase3Result })
      const { expectedForces } = createFleetBSetupPhase4Result
      const afterViews = await Promise.all(
        fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
      )

      // Assert: only B8 survives, all attack costs remain spent, and each Action instance is available again.
      expect(ownerPublicForces(afterViews[0]?.fleets ?? [], fixture.playerIds, target.id)).toStrictEqual(expectedForces)
      const survivor = Object.values(forward.resolved.fleets).find(
        ({ ownerPlayerId, originPlanetId }) => ownerPlayerId === fixture.playerIds[1] && originPlanetId === target.id,
      )
      Assert.isDefined(survivor)

      assertSurvivor({ ...createClientsSetupPhase3Result, ...createFleetBSetupPhase4Result, survivor, afterViews })

      const emptyTurn = afterViews[0]
      Assert.isDefined(emptyTurn)

      const assertEmptyObservedPhase6Observed = observed

      await assertEmptyObserved2({ ...createClientsSetupPhase3Result, emptyTurn, db, clock, assertEmptyObservedPhase6Observed })
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

    const assertAssertOutcomeForOwnerState1Phase7Observed = observed

    await assertOutcomeForOwner({
      forward,
      playerAId,
      assaultAction,
      attacker,
      fixture,
      permuted,
      playerBId,
      assertAssertOutcomeForOwnerState1Phase7Observed,
      turnProcessor,
      moveView,
      moveAction,
      enemy,
      enemyHome,
    })
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

      const createFixtureSetupPhase5Result = await createFixtureSetup({ db, clock, apiServer })
      const { fixture, alice, initialFriendly, enemy } = createFixtureSetupPhase5Result
      let {
        movingView,
        attackJourney,
        ordinaryJourney,
      }: { movingView: PlayerView; attackJourney: Fleet | undefined; ordinaryJourney: Fleet | undefined } = createFixtureSetupPhase5Result
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

      Assert.isDefined(attackJourney)
      Assert.isDefined(ordinaryJourney)
      const createBuildActionSetupPhase6Result = await createBuildActionSetup({
        ...createFixtureSetupPhase5Result,
        movingView,
        attackJourney,
        ordinaryJourney,
        db,
        clock,
      })
      const { observed, forward } = createBuildActionSetupPhase6Result

      const createEmptyObservedSetupPhase7Result = await createEmptyObservedSetup({
        ...createFixtureSetupPhase5Result,
        ...createBuildActionSetupPhase6Result,
        attackJourney,
        ordinaryJourney,
        db,
        clock,
      })
      const { emptyObserved } = createEmptyObservedSetupPhase7Result
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
