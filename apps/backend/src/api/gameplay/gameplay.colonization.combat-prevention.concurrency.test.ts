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
  BuildFleet10ForStaging,
  BuildFleet35,
  MoveFleetSpeed10,
  ColonizeFleetSpeed01,
  ColonizeFarFleetSpeed5,
  DeadEarlierAttackColonize,
  DeadFarAttackColonize,
  logReceipt,
  required,
  playerIdFor,
  type PublicFleet,
  findPublicFleet,
  hasResolvedResult,
  hasPreventedReason,
  describeOutcomeRecord,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
  createPublicNaturalRouteFixture,
} from "../../tests/colonization/gameplay.colonization.ts"

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

    const verifyEmptyTurnReplayPhase1Value1 = emptyTurnReplay.resolved.value
    const verifyEmptyTurnReplayPhase1Value2 = replay.resolved.value
    const verifyEmptyTurnReplayPhase1 = async (): Promise<void> => {
      expect(verifyEmptyTurnReplayPhase1Value1.removedFleetIds).toStrictEqual([])
      expect(verifyEmptyTurnReplayPhase1Value1.planetOwnershipChanges).toStrictEqual([])
      expect(emptyTurnReplay.nextRngState).toStrictEqual(emptyTurnInput.rngState)
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const emptyTurnView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(emptyTurnView.turn).toBe(arrivedView.turn + 1)
      expect(getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
      expect(emptyTurnView.fleets).toHaveLength(0)
      expect(emptyTurnView.resources).toStrictEqual(arrivedView.resources)
      expect(emptyTurnView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
      expect(
        await server.database
          .select()
          .from(fleetsTable)
          .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
      ).toHaveLength(0)

      logReceipt("[C3-03 public exact20 deletion receipt]", {
        gameId,
        seed: 1234,
        player: playerIdFor(player),
        home: { id: home.id, name: home.name, coordinates: home.coordinates },
        target: { id: target.id, name: target.name, coordinates: target.coordinates },
        builtStrength: sourceFleet.strength,
        departure: { turn: selectedView.turn, selected: 20, journeyId: journey.id },
        arrival: {
          turn: arrivedView.turn,
          owner: getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId,
          removedFleetIds: verifyEmptyTurnReplayPhase1Value2.removedFleetIds,
          changedPlanets: verifyEmptyTurnReplayPhase1Value2.planetOwnershipChanges,
        },
        resources: {
          influence: arrivedView.resources[ResourceType.INFLUENCE].total,
          metal: arrivedView.resources[ResourceType.METAL].total,
          colony: arrivedView.resources[ResourceType.COLONY].total,
        },
        nextEmptyTurn: {
          turn: emptyTurnView.turn,
          owner: getPlanets(emptyTurnView).find(({ id }) => id === target.id)?.ownerPlayerId,
          fleets: emptyTurnView.fleets.length,
          unchangedResources: JSON.stringify(emptyTurnView.resources) === JSON.stringify(arrivedView.resources),
          colonizeActionAvailable: emptyTurnView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress === false,
        },
      })
    }
    await verifyEmptyTurnReplayPhase1()
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

    const verifyFinalOutcomesPhase2 = async (): Promise<void> => {
      expect(finalOutcomes.filter((outcome) => hasResolvedResult(outcome, "exchanged 20 Strength with 20 enemy Strength"))).toHaveLength(1)
      expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before colonization"))).toHaveLength(2)
      expect(finalOutcomes.filter((outcome) => hasPreventedReason(outcome, "before its Assault"))).toHaveLength(1)
      expect(finalOutcomes).not.toContainEqual(
        expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(" colonized Planet ") }),
      )
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      views = await readViews(clients, gameId)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(views.map(({ fleets }) => fleets)).toStrictEqual([[], []])
      expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
        { total: 493, uncommitted: 493 },
        { total: 493, uncommitted: 493 },
      ])
      expect(views.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([99, 99])
      expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
      for (const [view, actionId] of [
        [required(views[0]), aliceAttemptId],
        [required(views[1]), bobAttemptId],
      ] as const) {
        expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      }
      expect(
        await server.database
          .select()
          .from(fleetsTable)
          .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
      ).toHaveLength(0)
    }
    await verifyFinalOutcomesPhase2()

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)

    const verifyPersistedNextRngStatePhase3Value1 = replay.resolved.value
    const verifyPersistedNextRngStatePhase3 = (): void => {
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

      logReceipt("[C3-05/16 public exact20 mutual Assault receipt]", {
        gameId,
        seed: 1,
        homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
        target: { id: target.id, name: target.name, coordinates: target.coordinates },
        routes: { aliceDistance, bobDistance, speed: { alice: 1, bob: 5 } },
        loadedForces: { alice: { fleetId: aliceFleet.id, strength: 20 }, bob: { fleetId: bobFleet.id, strength: 20 } },
        removedFleetIds: verifyPersistedNextRngStatePhase3Value1.removedFleetIds,
        arrivalTurn: workerInput.turn,
        continuations: [aliceContinuation, bobContinuation].map(({ originatingSubmission, departureTurn }) => ({
          actionId: originatingSubmission.id,
          departureTurn,
        })),
        outcomeTrace: finalOutcomes.map(describeOutcomeRecord),

        persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
        persistedFleets: views.flatMap(({ fleets }) => fleets),
        persistedResources: views.map(({ resources }) => ({
          influence: resources[ResourceType.INFLUENCE].total,
          fuel: resources[ResourceType.FUEL].total,
          colony: resources[ResourceType.COLONY].total,
        })),
        loadedRngState: workerInput.rngState,
        replayNextRngState: replay.nextRngState,
        persistedNextRngState,
      })
    }
    verifyPersistedNextRngStatePhase3()
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

    const verifyPersistedNextRngStatePhase4Value1 = replay.resolved.value
    const verifyPersistedNextRngStatePhase4 = (): void => {
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

      logReceipt("[C3-06 public claimed-in-transit Colonize receipt]", {
        gameId,
        seed: 1,
        homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
        target: { id: target.id, name: target.name, coordinates: target.coordinates },
        routes: { aliceDistance: 1.2645395167985714, bobDistance: 18.852953053708077, bobSpeed: 5 },
        ownerWhileTransit: playerIdFor(alice),
        transitDistances,
        finalArrivalTurn: workerInput.turn,
        finalFleet: verifyPersistedNextRngStatePhase4Value1.fleets[bobJourney.id],
        continuationOutcomes: bobContinuation.actionOutcomes,
        persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
        persistedFleets: views.flatMap(({ fleets }) => fleets),
        persistedResources: views.map(({ resources }) => ({
          influence: resources[ResourceType.INFLUENCE].total,
          fuel: resources[ResourceType.FUEL].total,
          colony: resources[ResourceType.COLONY].total,
        })),
        loadedRngState: workerInput.rngState,
        replayNextRngState: replay.nextRngState,
        persistedNextRngState,
      })
    }
    verifyPersistedNextRngStatePhase4()
  })

  it("should persist an ordinary public Move35 beside enemy10 without combat or claiming", async () => {
    // Arrange the seeded public game and Build submissions.
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views

    const aliceBuildId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const bobBuildId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    // Act: process the public Build submissions.
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
    // Assert both public Builds created the expected forces.
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
    expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    // Act: submit Bob ordinary Move.
    const bobMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    // Act: process Bob Move departure Turn.
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
    // Assert Bob captured journey follows the pinned route while the target stays unclaimed.
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobMoveId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    // Act: process Bob arrival Turn.
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
    // Assert Bob arrived at strength10 while the target remains unclaimed.
    const persistedEnemy = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
    expect(persistedEnemy.id).toBe(bobJourney.id)
    const bobReplayArrivalTick = stage.resolved.fleets[bobJourney.id]?.arrivedAtTick
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35).id).toBe(aliceSource.id)

    // Act: submit Alice ordinary Move35.
    const aliceMoveId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    expect(MoveFleetSpeed10.effects.map(({ type }) => type)).toStrictEqual(["FLEET_MOVE"])
    // Act: resolve Alice captured Move input through the real processor.
    const ordinaryArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = ordinaryArrival.views
    // Assert copied-input replay separately from the persisted player-view read-through.
    const replayMoveFleet = findPublicFleet(Object.values(ordinaryArrival.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
    })
    Assert.isDefined(replayMoveFleet)

    const verifyReplayMoveFleetPhase5 = (): void => {
      expect(replayMoveFleet.arrivedAtTick).toBe(3)
      const persistedMoveFleet = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
      expect(persistedMoveFleet.id).toBe(replayMoveFleet.id)

      expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).id).toBe(bobJourney.id)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(required(views[0]).actions.find(({ id }) => id === aliceMoveId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
      const aliceMoveOutcomes = ordinaryArrival.resolved.resolvedActions.find(
        ({ submittedAction }) => submittedAction.id === aliceMoveId,
      )?.actionOutcomes
      expect(aliceMoveOutcomes?.every(({ type }) => type === "RESOLVED")).toBe(true)

      logReceipt("[C3-11 public ordinary Move35/enemy10 control receipt]", {
        gameId,
        mapSeed: 1,
        homes: [
          { player: playerIdFor(alice), id: homeA.id, name: homeA.name, coordinates: homeA.coordinates },
          { player: playerIdFor(bob), id: homeB.id, name: homeB.name, coordinates: homeB.coordinates },
        ],
        target: { id: target.id, name: target.name, coordinates: target.coordinates },
        routes: {
          bobDistance: 18.852953053708077,
          aliceDistance: 1.2645395167985714,
          bobSpeed: 10,
          aliceSpeed: 10,
        },
        publicActions: {
          bobBuild10: bobBuildId,
          bobOrdinaryMove10: bobMoveId,
          aliceBuild35: aliceBuildId,
          aliceOrdinaryMove35: aliceMoveId,
        },
        copiedInputReplay: {
          bobArrivalTick: bobReplayArrivalTick,
          aliceArrivalTick: replayMoveFleet.arrivedAtTick,
          aliceActionOutcomes: ordinaryArrival.resolved.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceMoveId)
            ?.actionOutcomes,
        },
        persistedApiReadThrough: {
          planetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
          fleets: [persistedMoveFleet, persistedEnemy].map(({ id, ownerPlayerId, originPlanetId, strength }) => ({
            id,
            ownerPlayerId,
            originPlanetId,
            strength,
          })),
        },
      })
    }
    verifyReplayMoveFleetPhase5()
  })

  it("should colonize an unclaimed Planet with an enemy Fleet present and no Assault", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const aliceBuildId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    const bobBuildId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
    const built = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = built.views
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)
    expect(required(views[0]).actions.find(({ id }) => id === aliceBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === bobBuildId)).toMatchObject({ selectedTargets: null, isInProgress: false })

    const slowColonizeId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeFleetSpeed01.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const enemyMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    expect(Math.hypot(homeA.x - target.x, homeA.y - target.y)).toBeCloseTo(1.2645395167985714, 12)
    expect(Math.hypot(homeB.x - target.x, homeB.y - target.y)).toBeCloseTo(18.852953053708077, 12)

    const departed = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = departed.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === enemyMoveId)
    Assert.isDefined(aliceJourney)
    Assert.isDefined(bobJourney)
    expect(aliceJourney.strength).toBe(35)
    expect(aliceJourney.distanceToEnd).toBeCloseTo(Number("1.1645395167985714"), 12)
    expect(bobJourney.strength).toBe(10)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const enemyArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = enemyArrival.views
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toMatchObject({
      ownerPlayerId: required(views[1]).player.id,
      strength: 10,
    })
    const stillMovingColonizer = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(stillMovingColonizer)
    expect(stillMovingColonizer.distanceToEnd).toBeCloseTo(1.0645395167985714, 12)
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)

    for (let turn = 0; turn < 10; turn += 1) {
      const continued = await processTurnWithReplay({
        server,
        clock,
        turnsRepository,
        turnProcessor,
        clients,
        gameId,
        turn: required(views[0]).turn,
      })
      views = continued.views
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10).strength).toBe(10)
      expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)?.isInProgress).toBe(true)
    }
    const beforeFinalArrival = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === slowColonizeId)
    Assert.isDefined(beforeFinalArrival)
    expect(beforeFinalArrival.distanceToEnd).toBeCloseTo(0.0645395167985714, 12)

    const finalArrival = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = finalArrival.views
    const claimed = getPlanets(required(views[0])).find(({ id }) => id === target.id)
    Assert.isDefined(claimed)
    expect(claimed.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 15)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 25)).toBeDefined()
    expect(required(views[0]).actions.find(({ id }) => id === slowColonizeId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[1]).actions.find(({ id }) => id === enemyMoveId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(required(views[0]).resources[ResourceType.INFLUENCE].total).toBe(473)
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
    expect(required(views[0]).resources[ResourceType.COLONY].total).toBe(0)
    expect(required(views[1]).resources[ResourceType.COLONY].total).toBe(0)
    const colonizeContinuation = finalArrival.resolved.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === slowColonizeId,
    )
    Assert.isDefined(colonizeContinuation)
    expect(colonizeContinuation.actionOutcomes).toContainEqual(
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining(' colonized Planet "planet 649967" with 20 Strength') }),
    )
    logReceipt("[C3-11 public enemy-presence receipt]", {
      seed: 1,
      target: { id: target.id, name: target.name, coordinates: target.coordinates },
      arrivalDistance: {
        alice: Math.hypot(homeA.x - target.x, homeA.y - target.y),
        bob: Math.hypot(homeB.x - target.x, homeB.y - target.y),
      },
      enemyArrivalBeforeClaim: { owner: required(views[1]).player.id, strength: 10 },
      finalOwner: claimed.ownerPlayerId,
      colonizerSurvivor: 15,
      enemySurvivor: 10,
      colonizerInfluence: required(views[0]).resources[ResourceType.INFLUENCE].total,
      enemyInfluence: required(views[1]).resources[ResourceType.INFLUENCE].total,
    })
  })
})
