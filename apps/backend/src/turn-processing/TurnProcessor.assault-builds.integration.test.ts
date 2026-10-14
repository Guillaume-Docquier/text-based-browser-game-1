import { Assert } from "@guillaume-docquier/tools-ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { assertDefenderAfter } from "../tests/fleet-assertions/TurnProcessor.assault-builds-2.ts"
import {
  createFinalTargetForcesSetup,
  createAliceSetup,
  createEnemyJourneySetup,
} from "../tests/fleet-assertions/TurnProcessor.assault-builds.stages-2.ts"
import {
  createFixtureSetup,
  createAttackJourneySetup,
  createExpectedTargetForcesSetup,
  createFixtureSetup2,
  createFirstActionSetup,
  createTieDrawSetup,
  createFixtureSetup3,
  createOrdinaryActionSetup,
} from "../tests/fleet-assertions/TurnProcessor.assault-builds.stages.ts"
import {
  assertBuildActionResult,
  assertEmptyObserved,
  assertOwnerPublicForces,
  assertAssaultResults,
} from "../tests/fleet-assertions/TurnProcessor.assault-builds.ts"
import { processPublicTurn, ownerPublicForces, getActionToSubmintegrationTest } from "../tests/fleet-worker/TurnProcessor.scenarios.ts"
import { HomeArrivalMergeRuleset, WorkerI207Ruleset } from "../tests/fleet-worker/TurnProcessor.ts"

describe("TurnProcessor", () => {
  integrationTest("should include an enemy same-turn Build in a public arrival Assault", { timeout: 180_000 }, async ({ db }) => {
    // Arrange: leave Alice40 at her home, stage Bob20 at that origin, and retain Bob20 at his home.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
    using apiServer = new ApiServer(apiServices)

    const createFixtureSetupPhase1Result = await createFixtureSetup({ db, clock, apiServer })

    const createAttackJourneySetupPhase2Result = await createAttackJourneySetup({ ...createFixtureSetupPhase1Result })

    const createExpectedTargetForcesSetupPhase3Result = await createExpectedTargetForcesSetup({
      ...createFixtureSetupPhase1Result,
      ...createAttackJourneySetupPhase2Result,
      db,
      clock,
    })

    await assertBuildActionResult({
      ...createFixtureSetupPhase1Result,
      ...createAttackJourneySetupPhase2Result,
      ...createExpectedTargetForcesSetupPhase3Result,
    })
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

      const createFixtureSetupPhase4Result = await createFixtureSetup2({ db, clock, apiServer })
      const { fixture, playerAId, playerBId, source, defender, departureViews } = createFixtureSetupPhase4Result
      const beforeResourcesByOwner = departureViews.map((view) => {
        Assert.isDefined(view)
        return {
          influence: view.resources[ResourceType.INFLUENCE].total,
          fuel: view.resources[ResourceType.FUEL].total,
        }
      })

      const createFirstActionSetupPhase5Result = await createFirstActionSetup({
        ...createFixtureSetupPhase4Result,
        beforeResourcesByOwner,
        db,
        clock,
      })
      const { firstAction, secondAction, observed, forward, permuted, journeyIds, survivingArrival } = createFirstActionSetupPhase5Result
      Assert.isDefined(survivingArrival)

      const createTieDrawSetupPhase6Result = createTieDrawSetup({
        ...createFixtureSetupPhase4Result,
        ...createFirstActionSetupPhase5Result,
        survivingArrival,
      })
      const { tieDraw } = createTieDrawSetupPhase6Result
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

      const assertEmptyObservedPhase4Value1 = tieDraw.value
      const assertEmptyObservedPhase4Observed = observed

      await assertEmptyObserved({
        ...createFixtureSetupPhase4Result,
        ...createFirstActionSetupPhase5Result,
        ...createTieDrawSetupPhase6Result,
        emptyTurn,
        db,
        clock,
        assertEmptyObservedPhase4Observed,
        assertEmptyObservedPhase4Value1,
        afterArrivalViews,
      })
    },
  )

  integrationTest("should settle a public ordinary arrival before a later Assault arrival", { timeout: 180_000 }, async ({ db }) => {
    // Arrange: establish Alice40 at Bob's home and Bob10 at Alice's home on the fixed public map.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(HomeArrivalMergeRuleset))
    using apiServer = new ApiServer(apiServices)

    const createFixtureSetupPhase7Result = await createFixtureSetup3({ db, clock, apiServer })
    const { departureViews } = createFixtureSetupPhase7Result
    const beforeResourcesByOwner = departureViews.map((view) => {
      Assert.isDefined(view)
      return {
        influence: view.resources[ResourceType.INFLUENCE].total,
        fuel: view.resources[ResourceType.FUEL].total,
      }
    })

    const createOrdinaryActionSetupPhase8Result = await createOrdinaryActionSetup({
      ...createFixtureSetupPhase7Result,
      beforeResourcesByOwner,
      db,
      clock,
    })

    let { movingView } = createOrdinaryActionSetupPhase8Result

    const updatedVerifyOwnerPublicForces = await assertOwnerPublicForces({
      ...createFixtureSetupPhase7Result,
      ...createOrdinaryActionSetupPhase8Result,
      beforeResourcesByOwner,
      movingView,
    })
    movingView = updatedVerifyOwnerPublicForces.movingView

    const createFinalTargetForcesSetupPhase9Result = await createFinalTargetForcesSetup({
      ...createFixtureSetupPhase7Result,
      ...createOrdinaryActionSetupPhase8Result,
      db,
      clock,
      movingView,
    })

    await assertAssaultResults({
      ...createFixtureSetupPhase7Result,
      ...createOrdinaryActionSetupPhase8Result,
      ...createFinalTargetForcesSetupPhase9Result,
      beforeResourcesByOwner,
    })
  })

  integrationTest("should resolve the exact public defender30/outgoing20/incoming5/Build10 worker control", async ({ db }) => {
    // Arrange: use a stable public seed-147 game and build defender40/enemy20 through real API submissions and worker turns.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(WorkerI207Ruleset))
    using apiServer = new ApiServer(apiServices)

    const createAliceSetupPhase10Result = await createAliceSetup({ apiServer, db, clock })
    const { alice, bob, clients, playerIds, gameId, turnProcessor, target, bobHome, aliceInitial, afterSplit } =
      createAliceSetupPhase10Result
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

    const createEnemyJourneySetupPhase11Result = await createEnemyJourneySetup({ ...createAliceSetupPhase10Result, aliceAtStaging })

    await assertDefenderAfter({ ...createAliceSetupPhase10Result, ...createEnemyJourneySetupPhase11Result, aliceAtStaging, db, clock })
  })
})
