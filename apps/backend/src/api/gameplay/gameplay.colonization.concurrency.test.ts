import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  getPlanets,
  getHome,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  BuildFleet20ForExactColonize,
  PublicBudgetBuild35,
  PublicBudgetStageFleet,
  PublicColonizationBudgetRuleset,
  BuildFleet10ForStaging,
  BuildFleet16ForStaging,
  BuildFleet35,
  BuildFleet50,
  MoveFleetSpeed10,
  ComposedSuccessAttackColonize,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  hasResolvedResult,
  hasPreventedReason,
  findPlayerAction,
  findResolvedAction,
  describeOutcomeRecord,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"

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

    const verifyAssertLoadedJourneyState1Phase1 = (): void => {
      const assertLoadedJourneyState1 = (): void => {
        expect(loadedJourney).toMatchObject({
          id: attackerJourney.id,
          ownerPlayerId: playerIdFor(alice),
          strength: 50,
          destinationPlanetId: target.id,
          movement: { speed: 1, submission: { id: composedActionId } },
        })
        expect(loadedJourney.movement?.submission).toMatchObject({
          actionDefinitionId: ComposedSuccessAttackColonize.id,
          selectedTargets: { fleet: attacker.id, planet: target.id },
          selectedInputs: { strength: 50 },
        })
        expect(loadedJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
        expect(
          loadedJourney.movement?.pendingArrivalEffects.map(({ effectDefinition, definitionOrdinal }) => ({
            type: effectDefinition.type,
            definitionOrdinal,
            targets: effectDefinition.targets,
          })),
        ).toStrictEqual([
          {
            type: "FLEET_COLONIZE",
            definitionOrdinal: 1,
            targets: {
              fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
              planet: { actionTargetTag: "planet", targetType: "PLANET" },
            },
          },
          {
            type: "FLEET_ASSAULT",
            definitionOrdinal: 2,
            targets: {
              fleet: { actionTargetTag: "fleet", targetType: "FLEET" },
              planet: { actionTargetTag: "planet", targetType: "PLANET" },
            },
          },
        ])
        expect(arrivalInput.fleets[defender.id]).toMatchObject({ id: defender.id, ownerPlayerId: playerIdFor(bob), strength: 10 })
        expect(arrivalInput.planets[target.id]?.ownerPlayerId).toBeNull()
      }
      assertLoadedJourneyState1()
    }
    verifyAssertLoadedJourneyState1Phase1()

    const continuation = arrivalReplay.resolved.value.resolvedContinuations.find(
      ({ originatingSubmission }) => originatingSubmission.id === composedActionId,
    )
    Assert.isDefined(continuation)

    const verifyAssertContinuationState2ResolvedPhase2Value1 = arrivalReplay.resolved.value
    const verifyAssertContinuationState2ResolvedPhase2 = async (): Promise<void> => {
      const assertContinuationState2Resolved = verifyAssertContinuationState2ResolvedPhase2Value1
      const assertContinuationState2 = async (): Promise<void> => {
        expect(continuation.actionOutcomes).toHaveLength(4)
        expect(continuation.actionOutcomes.every(({ type }) => type === "RESOLVED")).toBe(true)
        expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "moved "))).toBe(true)
        expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "arrived on Planet"))).toBe(true)
        expect(
          continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "exchanged 10 Strength with 10 enemy Strength")),
        ).toBe(true)
        expect(continuation.actionOutcomes.some((outcome) => hasResolvedResult(outcome, "colonized Planet"))).toBe(true)
        expect(assertContinuationState2Resolved.removedFleetIds).toContain(defender.id)
        expect(assertContinuationState2Resolved.fleets[defender.id]).toBeUndefined()
        expect(assertContinuationState2Resolved.fleets[attackerJourney.id]).toMatchObject({
          ownerPlayerId: playerIdFor(alice),
          originPlanetId: target.id,
          strength: 20,
          movement: undefined,
          destinationPlanetId: undefined,
          distanceToEnd: undefined,
        })
        expect(assertContinuationState2Resolved.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(alice))
        expect(assertContinuationState2Resolved.planetOwnershipChanges).toStrictEqual([
          { planetId: target.id, ownerPlayerId: playerIdFor(alice) },
        ])
        expect(arrivalReplay.nextRngState).toStrictEqual(arrivalInput.rngState)

        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await assertContinuationState2()
      views = await readViews(clients, gameId)
      expect(required(views[0]).turn).toBe(arrivalTurn + 1)
      expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(alice))
      expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 20).id).toBe(attackerJourney.id)
      expect(required(views[1]).fleets.find(({ id }) => id === defender.id)).toBeUndefined()
      expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 473, uncommitted: 473 })
      expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
      expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(required(views[0]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
      expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
      expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
      expect(required(views[1]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
      expect(required(views[0]).actions.find(({ id }) => id === composedActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
    }
    await verifyAssertContinuationState2ResolvedPhase2()

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

      const verifyAssertReplayedTargetState1ResolvedPhase3Value1 = replay.resolved.value
      const verifyAssertReplayedTargetState1ResolvedPhase3 = async (): Promise<void> => {
        const assertReplayedTargetState1Resolved = verifyAssertReplayedTargetState1ResolvedPhase3Value1
        const assertReplayedTargetState1 = async (): Promise<void> => {
          expect(replayedTarget?.ownerPlayerId).toBeNull()
          expect(assertReplayedTargetState1Resolved.planetOwnershipChanges).toStrictEqual([])
          expect(continuation.actionOutcomes).toContainEqual(
            expect.objectContaining({
              type: "RESOLVED",
              result: expect.stringContaining(`exchanged ${defenderStrength} Strength with ${defenderStrength} enemy Strength`),
            }),
          )
          expect(continuation.actionOutcomes.some((outcome) => hasPreventedReason(outcome, preventedReason))).toBe(true)
          expect(assertReplayedTargetState1Resolved.fleets[loadedAttacker.id]?.strength).toBe(expectedSurvivingAttackerStrength)
          expect(assertReplayedTargetState1Resolved.fleets[loadedDefender.id]).toBeUndefined()
          expect(assertReplayedTargetState1Resolved.removedFleetIds).toContain(loadedDefender.id)
          expect(Object.values(assertReplayedTargetState1Resolved.fleets).filter(({ id }) => id === loadedAttacker.id)).toHaveLength(
            expectedAttackerFleetCount,
          )
          expect(assertReplayedTargetState1Resolved.removedFleetIds.filter((id) => id === loadedAttacker.id)).toHaveLength(
            expectedAttackerRemovalCount,
          )

          expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        }
        await assertReplayedTargetState1()
        views = await readViews(clients, gameId)
        expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
        expect(required(views[0]).fleets.find(({ id }) => id === loadedDefender.id)).toBeUndefined()
      }
      await verifyAssertReplayedTargetState1ResolvedPhase3()

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

      const verifyPersistedNextRngStatePhase4Value1 = replay.resolved.value
      const verifyPersistedNextRngStatePhase4 = (): void => {
        const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
        expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

        logReceipt("[C3-16 public composed prevention receipt]", {
          gameId,
          seed: 1,
          target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
          routes: { attacker: 1.2645395167985714, defender: defenderDistance },
          forces: {
            attackerBeforeCombat: attackerStrength,
            defenderBeforeCombat: defenderStrength,
            attackerAfterCombat: expectedSurvivingAttackerStrength,
          },
          action: {
            id: composedActionId,
            definitionId: ComposedSuccessAttackColonize.id,
            paidInfluenceOnce: 25,
            pendingTypes: ["FLEET_COLONIZE", "FLEET_ASSAULT"],
          },
          replay: {
            targetOwner: replayedTarget?.ownerPlayerId,
            attacker: verifyPersistedNextRngStatePhase4Value1.fleets[loadedAttacker.id]?.strength,
            defenderRemoved: verifyPersistedNextRngStatePhase4Value1.fleets[loadedDefender.id] === undefined,
            outcomes: continuation.actionOutcomes.map(describeOutcomeRecord),
          },
          persisted: {
            targetOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
            attacker: persistedAttacker?.strength,
            defenderRemoved: persistedFleetRows.find(({ id }) => id === loadedDefender.id) === undefined,
            influence: required(views[0]).resources[ResourceType.INFLUENCE],
            colony: required(views[0]).resources[ResourceType.COLONY],
            actionReleased: required(views[0]).actions.find(({ id }) => id === composedActionId)?.isInProgress === false,
            persistedNextRngState,
          },
        })
      }
      verifyPersistedNextRngStatePhase4()
    },
  )

  it("should use the current public stationary force after Move and Assault before Colonization", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const routeDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const enemyDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(routeDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(enemyDistance).toBeCloseTo(18.852953053708077, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
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
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const bobStageMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 1 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
      arrivedAtTick: 3,
    })
    const bobJourney = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: playerIdFor(bob), movementSubmissionId: bobStageMoveId }),
    )
    Assert.isDefined(aliceArrival)
    Assert.isDefined(bobJourney)
    expect(aliceArrival.arrivedAtTick).toBe(3)
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 35).id).toBe(aliceArrival.id)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[bobJourney.id]?.arrivedAtTick).toBe(18)
    const aliceStationary = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    const bobAssaultFleet = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 1)
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 9).strength).toBe(9)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const moveActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    const assaultActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const selectedViews = await readViews(clients, gameId)
    const assertRequiredState1 = (): void => {
      expect(required(selectedViews[0]).actions.find(({ id }) => id === moveActionId)).toMatchObject({
        selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
        selectedInputs: { strength: 15 },
      })
      expect(required(selectedViews[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
        selectedTargets: { fleet: aliceStationary.id, planet: target.id },
        selectedInputs: {},
      })
      expect(required(selectedViews[1]).actions.find(({ id }) => id === assaultActionId)).toMatchObject({
        selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
        selectedInputs: {},
      })
      expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 467 })
      expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
      expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
      expect(required(selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
    }
    assertRequiredState1()

    const turn = required(selectedViews[0]).turn
    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(3)
    expect(workerInput.submittedActions.find(({ id }) => id === moveActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    expect(workerInput.submittedActions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(workerInput.submittedActions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const moveResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === moveActionId)
    const colonizeResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === colonizeActionId)
    const assaultResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === assaultActionId)
    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    Assert.isDefined(assaultResult)
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(assaultResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    expect(replay.resolved.value.fleets[aliceStationary.id]?.strength).toBe(19)
    expect(replay.resolved.value.fleets[bobAssaultFleet.id]).toBeUndefined()
    expect(replay.resolved.value.removedFleetIds).toContain(bobAssaultFleet.id)
    const outgoingJourney = Object.values(replay.resolved.value.fleets).find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(outgoingJourney)
    expect(outgoingJourney).toMatchObject({
      ownerPlayerId: playerIdFor(alice),
      strength: 15,
      originPlanetId: target.id,
      destinationPlanetId: homeA.id,
      movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
    })
    expect(outgoingJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(required(views[0]).turn).toBe(turn + 1)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 19).id).toBe(aliceStationary.id)
    expect(required(views[1]).fleets.find(({ id }) => id === bobAssaultFleet.id)).toBeUndefined()
    const persistedJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(persistedJourney)
    const assertPersistedJourneyState2 = (): void => {
      expect(persistedJourney).toMatchObject({
        strength: 15,
        originPlanetId: target.id,
        destinationPlanetId: homeA.id,
        movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
      })
      expect(persistedJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
      expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 467, uncommitted: 467 })
      expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
      expect(required(views[0]).resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 495 })
      expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
      expect(required(views[0]).actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
        selectedTargets: null,
        isInProgress: false,
      })
    }
    assertPersistedJourneyState2()
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === turn + 1)
    Assert.isDefined(savedNextTurn)

    const verifyPersistedNextRngStatePhase5 = (): void => {
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

      logReceipt("[C3-19 public stationary post-Move/Assault receipt]", {
        gameId,
        seed: 1,
        target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
        sourceDistance: routeDistance,
        stagedForces: { alice35: aliceStationary.id, bob1: bobAssaultFleet.id },
        selected: { move15: moveActionId, stationaryColonize20: colonizeActionId, enemyAssault1: assaultActionId },
        workerOutcome: {
          owner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
          stationaryAfterAssault: 19,
          colonize: colonizeResult.actionOutcomes,
          defenderRemoved: true,
        },
        outgoingJourney: {
          id: persistedJourney.id,
          strength: persistedJourney.strength,
          destination: homeA.coordinates,
          remainingDistance: persistedJourney.distanceToEnd,
        },
        resourcesAfterUnrefundedCosts: {
          influence: required(views[0]).resources[ResourceType.INFLUENCE].total,
          fuel: required(views[0]).resources[ResourceType.FUEL].total,
        },
        rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
      })
    }
    verifyPersistedNextRngStatePhase5()
  })

  it("should claim a public35-force source after Move15 while preserving the Q-bound remainder15", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000046" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationBudgetRuleset.id,
        nbSeats: 1,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const home = getHome(view)
    const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
    Assert.isDefined(target)
    expect(home.coordinates).toBe("45:98:30")
    expect(target.coordinates).toBe("55:07:50")
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()

    const buildActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetBuild35.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const source = getFleetAt(view, view.player.id, home.id, 35)
    const stageActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetStageFleet.id,
      selectedTargets: { fleet: source.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const staged = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients: [player],
      gameId,
      turn: view.turn,
    })
    view = required(staged.views[0])
    const stagedArrival = Object.values(staged.resolved.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 35 }),
    )
    Assert.isDefined(stagedArrival)
    expect(stagedArrival.arrivedAtTick).toBeDefined()
    const stationary = getFleetAt(view, view.player.id, target.id, 35)
    expect(stationary.id).toBe(stagedArrival.id)

    const moveActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveActionId)).toMatchObject({
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: selectedView.turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(2)
    expect(findPlayerAction(workerInput.submittedActions, moveActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(findPlayerAction(workerInput.submittedActions, colonizeActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const moveResult = findResolvedAction(replay.resolved.value.resolvedActions, moveActionId, playerIdFor(player))

    const colonizeResult = findResolvedAction(replay.resolved.value.resolvedActions, colonizeActionId, playerIdFor(player))

    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    expect(moveResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.removedFleetIds).toContain(stationary.id)
    expect(replay.resolved.value.fleets[stationary.id]).toBeUndefined()
    const journey = findPublicFleet(Object.values(replay.resolved.value.fleets), {
      ownerPlayerId: playerIdFor(player),
      originPlanetId: target.id,
      destinationPlanetId: home.id,
      strength: 15,
      movementSubmissionId: moveActionId,
    })
    Assert.isDefined(journey)

    const verifyJourneyPhase6Value1 = replay.resolved.value
    const verifyJourneyPhase6 = async (): Promise<void> => {
      expect(journey.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
      expect(journey.movement).toMatchObject({ speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] })
      expect(verifyJourneyPhase6Value1.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(player))
      expect(verifyJourneyPhase6Value1.planetOwnershipChanges).toStrictEqual([{ planetId: target.id, ownerPlayerId: playerIdFor(player) }])
      expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      view = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(view.turn).toBe(selectedView.turn + 1)
      expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
      expect(view.fleets).toHaveLength(1)
      expect(view.fleets[0]).toMatchObject({
        id: journey.id,
        strength: 15,
        originPlanetId: target.id,
        destinationPlanetId: home.id,
        movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
      })
      expect(required(view.fleets[0]).distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 72, uncommitted: 72 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
      expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
    await verifyJourneyPhase6()

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-19 public Move15+stationary Colonize20 success receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      staging: { buildActionId, stageActionId, strength: 35, actualArrivalTick: stagedArrival.arrivedAtTick },
      selected: { move15: moveActionId, stationaryColonize20: colonizeActionId },
      result: {
        owner: playerIdFor(player),
        stationary35Consumed: true,
        journey: { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd },
      },
      payment: { influence: 28, fuel: 1, remaining: { influence: 72, fuel: 9 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })
})
