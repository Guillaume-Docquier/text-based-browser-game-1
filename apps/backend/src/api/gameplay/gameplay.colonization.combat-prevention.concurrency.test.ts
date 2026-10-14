import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import {
  getPlanets,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet20ForExactColonize,
  BuildFleet35,
  ColonizeFarFleetSpeed5,
  DeadEarlierAttackColonize,
  DeadFarAttackColonize,
  required,
  playerIdFor,
  type PublicFleet,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
  createPublicNaturalRouteFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  assertEmptyTurnReplay,
  assertFinalOutcomes,
  assertPersistedNextRngState,
  assertPersistedNextRngState2,
} from "../../tests/fleet-assertions/gameplay.colonization.combat-prevention.ts"

describe("public Colonization worker companions", () => {
  it("should persist exact20 Colonization as an owned Planet with no surviving Fleet row", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000041")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const buildAction = fixture.view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleet20ForExactColonize.id)
    Assert.isDefined(buildAction)

    await submitAction({
      client: player.client,
      gameId,
      view: fixture.view,
      actionDefinitionId: BuildFleet20ForExactColonize.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    const builtView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: fixture.view.turn,
    })
    const sourceFleet = getFleetAt(builtView, builtView.player.id, home.id, 20)
    expect(builtView.resources[ResourceType.INFLUENCE].total).toBe(58)
    expect(builtView.resources[ResourceType.METAL].total).toBe(4)

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view: builtView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 58, uncommitted: 33 })
    expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const departedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: selectedView.turn,
    })
    const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === colonizeActionId)
    Assert.isDefined(journey)
    expect(departedView.fleets.find(({ id }) => id === sourceFleet.id)).toBeUndefined()
    expect(getPlanets(departedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(departedView.resources[ResourceType.INFLUENCE].total).toBe(33)

    const arrivalInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: departedView.turn,
    })
    const replay = replayWorkerInputWithState(arrivalInput)
    Assert.isSuccess(replay.resolved)
    expect(replay.resolved.value.removedFleetIds).toContain(journey.id)
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
    expect(replay.nextRngState).toStrictEqual(arrivalInput.rngState)
    expect(await turnProcessor.processNextDueTurn()).toBe("processed")

    const arrivedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(arrivedView.turn).toBe(departedView.turn + 1)
    expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
    expect(arrivedView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(arrivedView.fleets.filter(({ originPlanetId }) => originPlanetId === target.id)).toHaveLength(0)
    expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 33, uncommitted: 33 })
    expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(arrivedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(
      await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
    ).not.toContainEqual(expect.objectContaining({ id: journey.id }))

    const emptyTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: arrivedView.turn,
    })
    expect(emptyTurnInput.submittedActions).toHaveLength(0)
    const emptyTurnReplay = replayWorkerInputWithState(emptyTurnInput)
    Assert.isSuccess(emptyTurnReplay.resolved)

    const assertEmptyTurnReplayPhase1Value1 = emptyTurnReplay.resolved.value
    const assertEmptyTurnReplayPhase1Value2 = replay.resolved.value

    await assertEmptyTurnReplay({
      assertEmptyTurnReplayPhase1Value1,
      emptyTurnReplay,
      emptyTurnInput,
      turnProcessor,
      player,
      gameId,
      arrivedView,
      target,
      colonizeActionId,
      server,
      home,
      sourceFleet,
      selectedView,
      journey,
      assertEmptyTurnReplayPhase1Value2,
    })
  })

  it("should prevent both exact20 public claimants after their Assaults destroy both Fleets", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    for (const [client, view, home] of [
      [alice, required(views[0]), homeA],
      [bob, required(views[1]), homeB],
    ] as const) {
      await submitAction({
        client: client.client,
        gameId,
        view,
        actionDefinitionId: BuildFleet20ForExactColonize.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      })
    }
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)
    const aliceFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)
    const bobFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 20)
    const aliceDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const bobDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(aliceDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(bobDistance).toBeCloseTo(18.852953053708077, 12)
    const bobAttemptId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: DeadFarAttackColonize.id,
      selectedTargets: { fleet: bobFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
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
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobAttemptId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(13.852953053708077, 12)
    for (const expectedDistance of [8.852953053708077]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      const movingBob: PublicFleet | undefined = required(views[1]).fleets.find(({ id }) => id === bobJourney.id)
      Assert.isDefined(movingBob)
      const remainingDistance = movingBob.distanceToEnd
      Assert.isDefined(remainingDistance)
      expect(remainingDistance).toBeCloseTo(expectedDistance, 12)
    }
    const aliceAttemptId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: DeadEarlierAttackColonize.id,
      selectedTargets: { fleet: aliceFleet.id, planet: target.id },
      selectedInputs: { strength: 20 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(selectedViews.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
      { total: 498, uncommitted: 493 },
      { total: 493, uncommitted: 493 },
    ])
    expect(selectedViews.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([100, 99])
    expect(selectedViews.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    expect(required(selectedViews[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    const finalMovement = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    views = finalMovement.views
    const finalAliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceAttemptId)
    Assert.isDefined(finalAliceJourney)
    expect(finalAliceJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(3.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    const loadedAliceJourney = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === aliceAttemptId)
    const loadedBobJourney = Object.values(workerInput.fleets).find(({ id }) => id === bobJourney.id)
    Assert.isDefined(loadedAliceJourney)
    Assert.isDefined(loadedBobJourney)
    expect(loadedBobJourney.movement?.submission.id).toBe(bobAttemptId)
    expect(replay.resolved.value.removedFleetIds).toStrictEqual(expect.arrayContaining([loadedAliceJourney.id, loadedBobJourney.id]))
    expect(replay.resolved.value.fleets[loadedAliceJourney.id]).toBeUndefined()
    expect(replay.resolved.value.fleets[loadedBobJourney.id]).toBeUndefined()
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    const aliceContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === aliceAttemptId,
    )
    const bobContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobAttemptId,
    )
    Assert.isDefined(aliceContinuation)
    Assert.isDefined(bobContinuation)
    for (const continuation of [aliceContinuation, bobContinuation]) {
      expect(continuation.actionOutcomes).toContainEqual(
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("arrived on Planet") }),
      )
    }
    const finalOutcomes = [...aliceContinuation.actionOutcomes, ...bobContinuation.actionOutcomes]

    const updatedVerifyFinalOutcomes = await assertFinalOutcomes({
      finalOutcomes,
      turnProcessor,
      views,
      clients,
      gameId,
      target,
      aliceAttemptId,
      bobAttemptId,
      server,
    })
    views = updatedVerifyFinalOutcomes.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)

    const assertPersistedNextRngStatePhase3Value1 = replay.resolved.value

    assertPersistedNextRngState({
      savedNextTurn,
      replay,
      gameId,
      homeA,
      homeB,
      target,
      aliceDistance,
      bobDistance,
      aliceFleet,
      bobFleet,
      assertPersistedNextRngStatePhase3Value1,
      workerInput,
      aliceContinuation,
      bobContinuation,
      finalOutcomes,
      views,
    })
  })

  it("should prevent a captured Colonize intent after its target is claimed while the Fleet is in transit", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    for (const [client, view, home] of [
      [alice, required(views[0]), homeA],
      [bob, required(views[1]), homeB],
    ] as const) {
      await submitAction({
        client: client.client,
        gameId,
        view,
        actionDefinitionId: BuildFleet35.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      })
    }
    await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
    views = await readViews(clients, gameId)
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

    const stageMoveId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
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
    const stagedAlice = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(stage.resolved.removedFleetIds).toContain(aliceSource.id)
    expect(required(views[0]).fleets.find(({ id }) => id === aliceSource.id)).toBeUndefined()
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(required(views[0]).actions.find(({ id }) => id === stageMoveId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    const bobColonizeId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizeFarFleetSpeed5.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const aliceColonizeId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stagedAlice.id, planet: target.id },
      selectedInputs: {},
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL].total).toBe(95)
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 498, uncommitted: 473 })
    expect(required(selectedViews[1]).resources[ResourceType.FUEL].total).toBe(100)

    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobColonizeId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(13.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
    expect(required(views[0]).actions.find(({ id }) => id === aliceColonizeId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ isInProgress: true })
    const transitDistances = [13.852953053708077]

    for (const expectedDistance of [8.852953053708077, 3.852953053708077]) {
      stage = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = stage.views
      const movingBob: PublicFleet | undefined = required(views[1]).fleets.find(({ id }) => id === bobJourney.id)
      Assert.isDefined(movingBob)
      const remainingDistance = movingBob.distanceToEnd
      Assert.isDefined(remainingDistance)
      expect(remainingDistance).toBeCloseTo(expectedDistance, 12)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
      expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
      expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ isInProgress: true })
      transitDistances.push(remainingDistance)
    }

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    const loadedBobJourney = Object.values(workerInput.fleets).find(({ id }) => id === bobJourney.id)
    Assert.isDefined(loadedBobJourney)
    expect(loadedBobJourney.movement?.submission.id).toBe(bobColonizeId)
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(replay.resolved.value.fleets[bobJourney.id]).toMatchObject({
      ownerPlayerId: playerIdFor(bob),
      originPlanetId: target.id,
      strength: 35,
      movement: undefined,
    })
    const bobContinuation = replay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === bobColonizeId,
    )
    Assert.isDefined(bobContinuation)
    expect(bobContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("arrived on Planet") }),
    )
    expect(bobContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }),
    )
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 15).id).toBe(stagedAlice.id)
    expect(getFleetAt(required(views[0]), playerIdFor(bob), target.id, 35).id).toBe(bobJourney.id)
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
    expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 473, uncommitted: 473 })
    expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)

    const assertPersistedNextRngStatePhase4Value1 = replay.resolved.value

    assertPersistedNextRngState2({
      savedNextTurn,
      replay,
      gameId,
      homeA,
      homeB,
      target,
      alice,
      transitDistances,
      workerInput,
      assertPersistedNextRngStatePhase4Value1,
      bobJourney,
      bobContinuation,
      views,
    })
  })
})
