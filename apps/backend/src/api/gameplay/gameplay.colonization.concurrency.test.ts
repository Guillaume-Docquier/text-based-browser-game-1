import { Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { describe, expect, it } from "vitest"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import {
  getPlanets,
  getFleetAt,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  BuildFleet20ForExactColonize,
  BuildFleet10ForStaging,
  BuildFleet16ForStaging,
  BuildFleet35,
  BuildFleet50,
  MoveFleetSpeed10,
  ComposedSuccessAttackColonize,
  logReceipt,
  required,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  assertLoadedJourney2,
  assertContinuation,
  assertReplayedTarget,
  assertPersistedNextRngState,
} from "../../tests/fleet-assertions/gameplay.colonization.ts"

describe("public Colonization worker companions", () => {
  it("should preserve composed Move, Assault, and Colonize phase order through public worker turns", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const attackerDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(attackerDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet50.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
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
    const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
    const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)
    expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([498, 498])
    expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99])

    const defenderMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: defenderSource.id, planet: target.id },
      selectedInputs: { strength: 10 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
    Assert.isDefined(defenderJourney)
    expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
    const defender = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 10)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(required(views[1]).resources[ResourceType.INFLUENCE].total).toBe(495)
    expect(required(views[1]).resources[ResourceType.FUEL].total).toBe(95)

    const composedActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
      actionDefinitionId: ComposedSuccessAttackColonize.id,
      selectedTargets: { fleet: attacker.id, planet: target.id },
      selectedInputs: { strength: 50 },
    })
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 498, uncommitted: 473 })
    expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })

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
    const attackerJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
    Assert.isDefined(attackerJourney)
    expect(attackerJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[0]).fleets.find(({ id }) => id === attacker.id)).toBeUndefined()
    expect(required(views[1]).fleets.find(({ id }) => id === defender.id)?.strength).toBe(10)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const arrivalTurn = required(views[0]).turn
    const arrivalInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: arrivalTurn })
    const arrivalReplay = replayWorkerInputWithState(arrivalInput)
    Assert.isSuccess(arrivalReplay.resolved)
    const loadedDefinition = arrivalInput.ruleset.actionDefinitions[ComposedSuccessAttackColonize.id]
    Assert.isDefined(loadedDefinition)
    expect(loadedDefinition.effects.map(({ type }) => type)).toStrictEqual(["FLEET_COLONIZE", "FLEET_ASSAULT", "FLEET_MOVE"])
    expect(loadedDefinition.effects).toMatchObject([
      { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } }, parameters: { strengthRequirement: 20 } },
      { targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } } },
      {
        targets: { fleet: { actionTargetTag: "fleet" }, planet: { actionTargetTag: "planet" } },
        inputs: { strength: { actionInputTag: "strength", inputType: "POSITIVE_INTEGER" } },
        parameters: { speed: 1 },
      },
    ])
    const loadedJourney = arrivalInput.fleets[attackerJourney.id]
    Assert.isDefined(loadedJourney)

    assertLoadedJourney2({ loadedJourney, attackerJourney, alice, target, composedActionId, attacker, arrivalInput, defender, bob })

    const continuation = arrivalReplay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
    )
    Assert.isDefined(continuation)

    const assertAssertContinuationState2ResolvedPhase2Value1 = arrivalReplay.resolved.value

    const updatedAssertContinuation = await assertContinuation({
      assertAssertContinuationState2ResolvedPhase2Value1,
      continuation,
      defender,
      attackerJourney,
      alice,
      target,
      arrivalReplay,
      arrivalInput,
      turnProcessor,
      views,
      clients,
      gameId,
      arrivalTurn,
      composedActionId,
    })
    views = updatedAssertContinuation.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === arrivalTurn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(arrivalReplay.nextRngState)

    logReceipt("[C3-15 public composed success receipt]", {
      gameId,
      seed: 1,
      homes: [
        { id: homeA.id, coordinates: homeA.coordinates, x: homeA.x, y: homeA.y },
        { id: homeB.id, coordinates: homeB.coordinates, x: homeB.x, y: homeB.y },
      ],
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      distances: { attacker: attackerDistance, defender: defenderDistance },
      defender: { journeyId: defenderJourney.id, strength: 10, actualArrivalTick: 18, atTargetBeforeAttack: true },
      attacker: { journeyId: attackerJourney.id, strengthBeforeCombat: 50, actualArrivalTick: 6 },
      capturedEffectTypes: loadedDefinition.effects.map(({ type }) => type),
      capturedMappings: loadedDefinition.effects.map((effect) => ({ type: effect.type, targets: effect.targets })),
      outcomes: continuation.actionOutcomes,
      result: { owner: required(views[0]).player.id, strength: 20, defenderFleetRemoved: true },
      influence: { paidOnce: 25, remaining: required(views[0]).resources[ResourceType.INFLUENCE].total },
      rng: { preResolution: arrivalInput.rngState, replayNext: arrivalReplay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it.each([
    {
      attackerStrength: 35,
      attackerBuildDefinitionId: BuildFleet35.id,
      defenderStrength: 16,
      defenderBuildDefinitionId: BuildFleet16ForStaging.id,
      expectedSurvivingAttackerStrength: 19,
      expectedAttackerRemovalCount: 0,
      expectedAttackerFleetCount: 1,
      expectedAttackerAtTargetCount: 1,
      preventedReason: "Fleet has 19 Strength, below the 20 required to colonize",
    },
    {
      attackerStrength: 20,
      attackerBuildDefinitionId: BuildFleet20ForExactColonize.id,
      defenderStrength: 20,
      defenderBuildDefinitionId: BuildFleet20ForExactColonize.id,
      expectedSurvivingAttackerStrength: undefined,
      expectedAttackerRemovalCount: 1,
      expectedAttackerFleetCount: 0,
      expectedAttackerAtTargetCount: 0,
      preventedReason: "destroyed before colonization",
    },
  ])(
    "should persist composed Assault before Colonize at strength $attackerStrength versus $defenderStrength",
    async ({
      attackerStrength,
      defenderStrength,
      attackerBuildDefinitionId,
      defenderBuildDefinitionId,
      expectedSurvivingAttackerStrength,
      expectedAttackerRemovalCount,
      expectedAttackerFleetCount,
      expectedAttackerAtTargetCount,
      preventedReason,
    }) => {
      // Arrange
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicTwoPlayerFixture(server)
      const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
      let views = fixture.views
      const defenderDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
      expect(defenderDistance).toBeCloseTo(18.852953053708077, 12)
      expect(target.ownerPlayerId).toBeNull()

      await submitAction({
        client: alice.client,
        gameId,
        view: required(views[0]),
        actionDefinitionId: attackerBuildDefinitionId,
        selectedTargets: { planet: homeA.id },
        selectedInputs: {},
      })
      await submitAction({
        client: bob.client,
        gameId,
        view: required(views[1]),
        actionDefinitionId: defenderBuildDefinitionId,
        selectedTargets: { planet: homeB.id },
        selectedInputs: {},
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
      const attacker = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, attackerStrength)
      const defenderSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, defenderStrength)
      const defenderMoveId = await submitAction({
        client: bob.client,
        gameId,
        view: required(views[1]),
        actionDefinitionId: MoveFleetSpeed10.id,
        selectedTargets: { fleet: defenderSource.id, planet: target.id },
        selectedInputs: { strength: defenderStrength },
      })
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
      const defenderJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === defenderMoveId)
      Assert.isDefined(defenderJourney)
      expect(defenderJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)

      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
      // Act & Assert
      const composedActionId = await submitAction({
        client: alice.client,
        gameId,
        view: required(views[0]),
        actionDefinitionId: ComposedSuccessAttackColonize.id,
        selectedTargets: { fleet: attacker.id, planet: target.id },
        selectedInputs: { strength: attackerStrength },
      })
      const selectedViews = await readViews(clients, gameId)
      const selectedInfluence = required(selectedViews[0]).resources[ResourceType.INFLUENCE]
      expect(selectedInfluence.uncommitted).toBe(selectedInfluence.total - 25)
      expect(required(selectedViews[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

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
      const arrivingJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === composedActionId)
      Assert.isDefined(arrivingJourney)
      expect(arrivingJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
      expect(stage.resolved.fleets[defenderJourney.id]?.arrivedAtTick).toBe(18)
      expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, defenderStrength).id).toBe(defenderJourney.id)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

      const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: required(views[0]).turn })
      const replay = replayWorkerInputWithState(workerInput)
      Assert.isSuccess(replay.resolved)
      const loadedAttacker = Object.values(workerInput.fleets).find(({ movement }) => movement?.submission.id === composedActionId)
      Assert.isDefined(loadedAttacker)
      const loadedDefender = workerInput.fleets[defenderJourney.id]
      Assert.isDefined(loadedDefender)
      expect(loadedAttacker).toMatchObject({ strength: attackerStrength, movement: { submission: { id: composedActionId } } })
      expect(loadedDefender).toMatchObject({ strength: defenderStrength, originPlanetId: target.id })
      expect(loadedDefender.movement).toBeUndefined()
      expect(
        loadedAttacker.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
          type: effectDefinition.type,
          definitionOrdinal,
        })),
      ).toStrictEqual([
        { type: "FLEET_COLONIZE", definitionOrdinal: 1 },
        { type: "FLEET_ASSAULT", definitionOrdinal: 2 },
      ])

      const replayedTarget = replay.resolved.value.planets[target.id]
      const continuation = replay.resolved.value.resolvedContinuations.find(
        ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
      )
      Assert.isDefined(continuation)

      const assertAssertReplayedTargetState1ResolvedPhase3Value1 = replay.resolved.value

      const updatedAssertReplayedTarget = await assertReplayedTarget({
        assertAssertReplayedTargetState1ResolvedPhase3Value1,
        replayedTarget,
        continuation,
        defenderStrength,
        preventedReason,
        loadedAttacker,
        expectedSurvivingAttackerStrength,
        loadedDefender,
        expectedAttackerFleetCount,
        expectedAttackerRemovalCount,
        turnProcessor,
        views,
        clients,
        gameId,
        target,
      })
      views = updatedAssertReplayedTarget.views

      const persistedAttacker = required(views[0]).fleets.find(({ id }) => id === loadedAttacker.id)
      expect(persistedAttacker?.strength).toBe(expectedSurvivingAttackerStrength)

      expect(persistedAttacker?.movement).toBeUndefined()
      expect(persistedAttacker?.destinationPlanetId).toBeUndefined()
      expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({
        total: selectedInfluence.total - 25,
        uncommitted: selectedInfluence.total - 25,
      })
      expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })

      const persistedFleetRows = await server.database
        .select()
        .from(fleetsTable)
        .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId)))
      expect(persistedFleetRows.find(({ id }) => id === loadedDefender.id)).toBeUndefined()
      expect(persistedFleetRows.find(({ id }) => id === loadedAttacker.id)?.strength).toBe(expectedSurvivingAttackerStrength)
      expect(persistedFleetRows.filter(({ id }) => id === loadedAttacker.id)).toHaveLength(expectedAttackerFleetCount)
      expect(
        persistedFleetRows.filter(({ id }) => id === loadedAttacker.id).filter(({ originPlanetId }) => originPlanetId === target.id),
      ).toHaveLength(expectedAttackerAtTargetCount)
      const savedTurns = await server.database
        .select()
        .from(turnsTable)
        .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
      const savedNextTurn = savedTurns.find(({ turn }) => turn === workerInput.turn + 1)
      Assert.isDefined(savedNextTurn)

      const assertPersistedNextRngStatePhase4Value1 = replay.resolved.value

      assertPersistedNextRngState({
        savedNextTurn,
        replay,
        gameId,
        target,
        defenderDistance,
        attackerStrength,
        defenderStrength,
        expectedSurvivingAttackerStrength,
        composedActionId,
        replayedTarget,
        assertPersistedNextRngStatePhase4Value1,
        loadedAttacker,
        loadedDefender,
        continuation,
        views,
        persistedAttacker,
        persistedFleetRows,
      })
    },
  )
})
