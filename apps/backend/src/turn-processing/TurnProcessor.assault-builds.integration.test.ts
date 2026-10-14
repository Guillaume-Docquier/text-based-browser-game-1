import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
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
  mulberry32FirstDraw,
  normalizedOutcomeSequence,
  ownerFleetForces,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { HomeArrivalMergeRuleset, WorkerI207Ruleset, createPublicHomeArrivalFixture } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
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
    const assertOwnerFleetForcesState1 = (): void => {
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
    }
    assertOwnerFleetForcesState1()
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

    const verifyBuildActionResultPhase1 = async (): Promise<void> => {
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
    }
    await verifyBuildActionResultPhase1()
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

      const verifyReservedViewPhase2 = async (): Promise<void> => {
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
      }
      await verifyReservedViewPhase2()

      // Assert: both captured journeys and the5-force source remainder persist across three intermediate worker reloads.
      let movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
      const journeyIdByAction = new Map<string, typeof source.id>()

      const verifyJourneyForcesPhase3 = async (): Promise<void> => {
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
      }
      await verifyJourneyForcesPhase3()

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

      const verifyEmptyObservedPhase4Value1 = tieDraw.value
      const verifyEmptyObservedPhase4Observed = observed
      const verifyEmptyObservedPhase4 = async (): Promise<void> => {
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
            generatorState: verifyEmptyObservedPhase4Observed.rngState.generatorState,
            tieDraw: verifyEmptyObservedPhase4Value1,
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
      }
      await verifyEmptyObservedPhase4()
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

    const verifyReservedViewPhase5 = async (): Promise<void> => {
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
    }
    await verifyReservedViewPhase5()

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

    const verifyOwnerPublicForcesPhase6 = async (): Promise<void> => {
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
    }
    await verifyOwnerPublicForcesPhase6()

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

    const verifyAssaultResultsPhase7 = async (): Promise<void> => {
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
    }
    await verifyAssaultResultsPhase7()
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

    const verifyTargetPhase8 = async (): Promise<void> => {
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
    }
    await verifyTargetPhase8()

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

    const verifyActionSelectionsPhase9 = async (): Promise<void> => {
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
    }
    await verifyActionSelectionsPhase9()

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

    const verifyAssertDefenderAfterState1Phase10 = async (): Promise<void> => {
      const assertDefenderAfterState1 = (): void => {
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
          afterCombat.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets).find(({ id }) => id === target.id)
            ?.ownerPlayerId,
        ).toBe(playerIds[0])
        expect(afterCombat.actions.find(({ id }) => id === enemyJourney.movement?.submission.id)).toMatchObject({
          selectedTargets: null,
          isInProgress: false,
        })
      }
      assertDefenderAfterState1()
      const emptyTurn = afterCombat.turn
      await processPublicTurn({ clients, gameId, turn: emptyTurn, turnProcessor, process: false })
      const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId, turn: emptyTurn })
      expect(emptyObserved.submittedActions).toStrictEqual([])
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const afterEmpty = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(afterEmpty.fleets.find(({ id }) => id === defenderAfter.id)?.strength).toBe(5)
      expect(afterEmpty.fleets.find(({ id }) => id === outboundJourney.id)?.strength).toBe(20)
    }
    await verifyAssertDefenderAfterState1Phase10()
  })
})
