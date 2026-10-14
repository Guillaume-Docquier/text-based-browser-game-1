import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { turnsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { getFleetAt, processTurnWithReplay } from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  DeadEarlierAttackColonize,
  required,
  findPublicFleet,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  createBobJourneyIdSetup,
  createUpdatedVerifyLaterReplaySetup,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.stages-2.ts"
import {
  createAliceSetup,
  createBobDistanceSetup,
  createAliceColonizeActionIdSetup,
  createViewsSetup,
  createOrdinaryActionIdSetup,
  createPersistedFriendlyFleetsSetup,
  createClientsSetup,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.stages.ts"
import {
  assertPersistedNextRngState,
  assertPersistedNextRngState2,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.ts"

describe("public Colonization worker companions", () => {
  it("should publicly prevent a dead earlier claimant and let the arriving Assault colonize", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const createAliceSetupPhase1Result = await createAliceSetup({ server })
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, aliceHome, bobHome, target, aliceDistance } =
      createAliceSetupPhase1Result
    let { views } = createAliceSetupPhase1Result

    const createBobDistanceSetupPhase2Result = await createBobDistanceSetup({ ...createAliceSetupPhase1Result, server })
    const { bobDistance } = createBobDistanceSetupPhase2Result
    let { stage } = createBobDistanceSetupPhase2Result
    views = stage.views
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, aliceHome.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, bobHome.id, 70)

    const aliceMoveActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceMoveActionId)
    Assert.isDefined(aliceJourney)
    expect(aliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(required(views[0]).fleets.find(({ id }) => id === aliceJourney.id)?.distanceToEnd).toBeCloseTo(0.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[aliceJourney.id]?.arrivedAtTick).toBe(3)
    const stagedAlice = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(bobSource.strength).toBe(70)

    const bobAttackColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: DeadEarlierAttackColonize.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 70 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobAttackColonizeActionId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(3.116999448433268, 12)
    for (const expectedDistance of [2.116999448433268, 1.116999448433268, 0.116999448433268]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }

    const createAliceColonizeActionIdSetupPhase3Result = await createAliceColonizeActionIdSetup({
      ...createAliceSetupPhase1Result,
      views,
      stagedAlice,
      bobJourney,
      server,
      bobAttackColonizeActionId,
    })
    const { aliceColonizeActionId, finalTurn, finalWorkerInput, finalReplay, bobContinuation, updatedVerifyFinalReplay } =
      createAliceColonizeActionIdSetupPhase3Result
    views = updatedVerifyFinalReplay.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === finalTurn.turn + 1)
    Assert.isDefined(savedNextTurn)

    Assert.isSuccess(finalReplay.resolved)
    const assertPersistedNextRngStatePhase2Value1 = finalReplay.resolved.value

    assertPersistedNextRngState({
      savedNextTurn,
      finalReplay,
      gameId,
      target,
      aliceDistance,
      bobDistance,
      stagedAlice,
      bobJourney,
      bobContinuation,
      assertPersistedNextRngStatePhase2Value1,
      aliceColonizeActionId,
      bob,
      finalWorkerInput,
      views,
    })
  })

  it("should preserve arrival provenance while public ordinary and colonization arrivals merge", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    const createViewsSetupPhase4Result = await createViewsSetup({
      fixture,
      target,
      alice,
      gameId,
      homeA,
      bob,
      homeB,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
    })
    const { stagingFleet, aliceStageActionId, bobStageActionId } = createViewsSetupPhase4Result
    let { views } = createViewsSetupPhase4Result
    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const stagedFriendlyArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: required(views[0]).player.id,
      originPlanetId: target.id,
      strength: 10,
    })
    Assert.isDefined(stagedFriendlyArrival)
    expect(stagedFriendlyArrival.arrivedAtTick).toBe(6)
    expect(stage.resolved.removedFleetIds).toContain(stagingFleet.id)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobStageActionId)
    Assert.isDefined(bobJourney)
    const bobJourneyId = bobJourney.id
    expect(bobJourney.distanceToEnd).toBeCloseTo(15.111265402761585, 12)
    const stagedFriendly = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
    expect(stagedFriendly.id).toBe(stagedFriendlyArrival.id)

    const bobStagingDistances = [10.111265402761585, 5.111265402761585, 0.111265402761585]
    for (const expectedDistance of bobStagingDistances) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      const currentJourney = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
      Assert.isDefined(currentJourney)
      expect(currentJourney.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views

    const createOrdinaryActionIdSetupPhase5Result = await createOrdinaryActionIdSetup({
      stage,
      bobJourneyId,
      views,
      homeA,
      target,
      stagedFriendly,
      alice,
      gameId,
      bob,
      clients,
      server,
      clock,
      turnsRepository,
    })
    const {
      ordinaryActionId,
      aliceColonizeActionId,
      bobColonizeActionId,
      selectedViews,
      finalTurnInput,
      finalReplay,
      publicReplay,
      friendlyWinner,
    } = createOrdinaryActionIdSetupPhase5Result
    expect(friendlyWinner).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 40,
      arrivedAtTick: 3,
    })
    const bobWinner = findPublicFleet(Object.values(publicReplay.value.fleets), {
      ownerPlayerId: required(selectedViews[1]).player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(bobWinner)
    expect(bobWinner.arrivedAtTick).toBe(7)
    expect(publicReplay.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[1]).player.id)
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === bobColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === ordinaryActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)

    const createPersistedFriendlyFleetsSetupPhase6Result = await createPersistedFriendlyFleetsSetup({
      ...createOrdinaryActionIdSetupPhase5Result,
      views,
      target,
      stagedFriendly,
      homeA,
      server,
      gameId,
    })
    const { persistedFriendlyFleets, savedNextTurn } = createPersistedFriendlyFleetsSetupPhase6Result

    assertPersistedNextRngState2({
      savedNextTurn,
      finalTurnInput,
      gameId,
      views,
      homeA,
      target,
      stagedFriendly,
      persistedFriendlyFleets,
      finalReplay,
      bobStageActionId,
      aliceStageActionId,
    })
  })

  it("should let the earlier speed-2 claimant beat a later speed-1 arrival on the next Turn", async () => {
    expect.hasAssertions()

    await using server = await ConcurrencyTestApiServer.create()

    const createClientsSetupPhase7Result = await createClientsSetup({ server })
    const { clients, gameId } = createClientsSetupPhase7Result
    let { views } = createClientsSetupPhase7Result

    const createBobJourneyIdSetupPhase8Result = await createBobJourneyIdSetup({ ...createClientsSetupPhase7Result, server })

    views = await readViews(clients, gameId)

    const createUpdatedVerifyLaterReplaySetupPhase9Result = await createUpdatedVerifyLaterReplaySetup({
      ...createClientsSetupPhase7Result,
      ...createBobJourneyIdSetupPhase8Result,
      views,
      server,
    })
    const { updatedVerifyLaterReplay } = createUpdatedVerifyLaterReplaySetupPhase9Result
    views = updatedVerifyLaterReplay.views
  })
})
