import { Assert, branded, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView, Planet, Action, Fleet } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  StrengthRaceRuleset,
  ComposedReservationRaceRuleset,
  ResourceRaceRuleset,
  processManualDeadlineTurn,
  normalizeApiDate,
  waitForCollectingSuccessor,
  createStartGate,
  submitMoveAfterGate,
  submitBuildAfterGate,
} from "../../tests/fleet-concurrency/gameplay.scenarios.ts"
import { TURN_INTERVAL, MANUAL_WORKER_TURN_INTERVAL } from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should serialize real PostgreSQL resource and fleet-strength reservations and round-trip departures", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(StrengthRaceRuleset))
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ResourceRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: strengthGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: StrengthRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: strengthGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    // Build a strength-50 source Fleet using the public API and real PostgreSQL turn persistence.
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const origin = playerView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = playerView.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)

    const updatedVerifyBuildCount = await assertBuildCount({
      playerView,
      player,
      strengthGameId,
      origin,
      clock,
      turnProcessor,
      turnsRepository,
    })
    playerView = updatedVerifyBuildCount.playerView

    const sourceFleet = playerView.fleets[0]
    const moveOne = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const moveTwo = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
    const moveThree = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_3")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveOne)
    Assert.isDefined(moveTwo)
    Assert.isDefined(moveThree)
    expect(sourceFleet.strength).toBe(50)

    // Act
    // Both independent 30-strength submissions start together; the turn-row lock permits one.
    const thirtyStrengthGate = createStartGate(2)
    const thirtyStrengthResults = await Promise.allSettled([
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveOne.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
      submitMoveAfterGate(thirtyStrengthGate, {
        client: player.client,
        gameId: strengthGameId,
        turn: playerView.turn,
        actionId: moveTwo.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])

    // Assert
    expect(thirtyStrengthResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(thirtyStrengthResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterThirtyRace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const firstStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveOne.id)
    const secondStrengthAction = afterThirtyRace.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(firstStrengthAction)
    Assert.isDefined(secondStrengthAction)
    const thirtyStrengthSelections = [firstStrengthAction, secondStrengthAction].filter(({ selectedInputs }) => selectedInputs !== null)
    expect(thirtyStrengthSelections).toHaveLength(1)
    expect(thirtyStrengthSelections[0]?.selectedInputs).toStrictEqual({ strength: 30 })
    const expectedThirtyStrengthSelectionByStatus = {
      fulfilled: {
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 30 },
      },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstStrengthAction, secondStrengthAction].entries()) {
      const submission = thirtyStrengthResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedThirtyStrengthSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
    expect(afterThirtyRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
    expect(afterThirtyRace.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
    const sourceAfterThirtyRace = afterThirtyRace.fleets.find(({ id }) => id === sourceFleet.id)
    const reservedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(sourceAfterThirtyRace)
    Assert.isDefined(reservedThirtyAction)
    expect(sourceAfterThirtyRace.strength).toBe(50)
    expect(sourceAfterThirtyRace.strength - 30).toBe(20)

    const selectedThirtyAction = thirtyStrengthSelections[0]
    Assert.isDefined(selectedThirtyAction)

    await assertCancelReplaceResults({ player, strengthGameId, playerView, selectedThirtyAction, moveThree, sourceFleet, destination })
    const afterCancelReplace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveThreeAfterRace = afterCancelReplace.actions.find(({ id }) => id === moveThree.id)
    Assert.isDefined(moveThreeAfterRace)

    await assertPersistedCancelReplaceState({
      moveThreeAfterRace,
      afterCancelReplace,
      sourceFleet,
      destination,
      player,
      strengthGameId,
      playerView,
      moveThree,
      moveOne,
      moveTwo,
    })
    const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveOneBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveOne.id)
    const moveTwoBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(moveOneBeforeDeparture)
    Assert.isDefined(moveTwoBeforeDeparture)

    await assertMoveOneBeforeDeparture({
      moveOneBeforeDeparture,
      sourceFleet,
      destination,
      moveTwoBeforeDeparture,
      beforeDeparture,
      clock,
      turnProcessor,
      turnsRepository,
      player,
      strengthGameId,
      moveOne,
      moveTwo,
      origin,
    })

    // A separate resource-only race cannot spend the same Influence twice.
    const { createdGameId: resourceGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ResourceRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: resourceGameId })
    const resourceView = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    const resourceOrigin = resourceView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === resourceView.player.id)
    const firstBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_1")
    const secondBuild = resourceView.actions.find(({ id }) => id === "BUILD_FLEET_STANDARD_2")
    Assert.isDefined(resourceOrigin)
    Assert.isDefined(firstBuild)
    Assert.isDefined(secondBuild)
    const resourceGate = createStartGate(2)
    const resourceResults = await Promise.allSettled([
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: firstBuild.id,
        planetId: resourceOrigin.id,
      }),
      submitBuildAfterGate(resourceGate, {
        client: player.client,
        gameId: resourceGameId,
        turn: resourceView.turn,
        actionId: secondBuild.id,
        planetId: resourceOrigin.id,
      }),
    ])
    expect(resourceResults.filter(({ status }) => status === "fulfilled")).toHaveLength(1)
    expect(resourceResults.filter(({ status }) => status === "rejected")).toHaveLength(1)
    const afterResourceRace = await player.client.gameplay.getPlayerView.query({ gameId: resourceGameId })
    expect(afterResourceRace.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 3, uncommitted: 1 })
    const firstBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === firstBuild.id)
    const secondBuildAfterRace = afterResourceRace.actions.find(({ id }) => id === secondBuild.id)
    Assert.isDefined(firstBuildAfterRace)
    Assert.isDefined(secondBuildAfterRace)
    const expectedBuildSelectionByStatus = {
      fulfilled: { selectedTargets: { planet: resourceOrigin.id }, selectedInputs: {} },
      rejected: { selectedTargets: null, selectedInputs: null },
    }
    for (const [index, action] of [firstBuildAfterRace, secondBuildAfterRace].entries()) {
      const submission = resourceResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedBuildSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }
  })

  it("should serialize the composed Move and Attack reservation race on fresh PostgreSQL", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(ComposedReservationRaceRuleset))
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ComposedReservationRaceRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
    const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(origin)
    Assert.isDefined(destination)
    expect({ x: origin.x, y: origin.y }).toStrictEqual({ x: 58.43842436611536, y: 49.61917707239218 })
    expect({ x: destination.x, y: destination.y }).toStrictEqual({ x: 57.77998524757335, y: 50.556704120958045 })

    // Act: create source strength50 with five real saved turns and preserve exactly8I/2F.
    for (let buildCount = 0; buildCount < 5; buildCount += 1) {
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: playerView.turn })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    }

    const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
    const moveAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
    const attackAction = playerView.actions.find(({ id }) => id === AttackMoveTest.id + "_1")
    Assert.isDefined(sourceFleet)
    Assert.isDefined(moveAction)
    Assert.isDefined(attackAction)
    expect(sourceFleet.strength).toBe(50)
    expect(playerView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 8 })
    expect(playerView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 2 })

    const startTogether = createStartGate(2)
    const reservationRace = await Promise.allSettled([
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: moveAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 20,
      }),
      submitMoveAfterGate(startTogether, {
        client: player.client,
        gameId,
        turn: playerView.turn,
        actionId: attackAction.id,
        fleetId: sourceFleet.id,
        destinationId: destination.id,
        strength: 30,
      }),
    ])
    expect(reservationRace.map(({ status }) => status)).toStrictEqual(["fulfilled", "fulfilled"])

    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    })
    expect(selectedView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 30 },
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
    expect(selectedView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(50)

    // Assert: PostgreSQL-backed actual worker charges both costs once and persists both exact departures.
    await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: selectedView.turn })
    const afterWorkerDeparture = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
    expect(afterWorkerDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
    expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
    expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
    expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
  })

  it("should serialize cancellation against Ready with the production PostgreSQL worker", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
    })

    // Act
    // Cancellation and Ready contend on the real turn row; the final influence total identifies the locked set.
    const gate = createStartGate(2)
    const [cancellation, readiness] = await Promise.allSettled([
      (async (): Promise<void> => {
        await gate()
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
        })
      })(),
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateReadiness.mutate({ gameId, turn: initialView.turn, isReady: true })
      })(),
    ])
    expect(readiness.status).toBe("fulfilled")
    const expectedCancellationResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "CONFLICT" } } },
    }
    expect(cancellation).toMatchObject(expectedCancellationResultByStatus[cancellation.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
      rejected: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
    }
    const expected = expectedByStatus[cancellation.status]

    // Assert
    const afterReady = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedReadinessObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        isReady: true,
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        isReady: false,
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedReadinessObservation = expectedReadinessObservationByTurn[afterReady.turn]
    Assert.isDefined(expectedReadinessObservation)
    expect(expectedReadinessObservation.statuses).toContain(afterReady.turnStatus)
    expect(afterReady.player.isReady).toBe(expectedReadinessObservation.isReady)
    const observedAction = afterReady.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedReadinessObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedReadinessObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })

    await assertSuccessorView({ successorView, expected, player, gameId, initialView, action })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })

  it("should serialize deadline submission against the actual PostgreSQL due-turn transition", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const player = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
    const action = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(action)
    const turnsRepository = new TurnsRepository({ db: server.database, logger: Logger.get() })

    // Act
    // Submission and the real due-turn transition contend on this game's turn row at its scheduled deadline.
    const gate = createStartGate(2)
    const [submission, closure] = await Promise.allSettled([
      (async (): Promise<unknown> => {
        await gate()
        return await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: initialView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
        })
      })(),
      (async (): Promise<void> => {
        await gate()
        await turnsRepository.markDueTurnsAwaitingProcessing({ since: normalizeApiDate(initialView.turnEndsAt) })
      })(),
    ])
    expect(closure.status).toBe("fulfilled")
    const expectedSubmissionResultByStatus = {
      fulfilled: { status: "fulfilled" },
      rejected: { status: "rejected", reason: { data: { code: "CONFLICT" } } },
    }
    expect(submission).toMatchObject(expectedSubmissionResultByStatus[submission.status])
    const expectedByStatus = {
      fulfilled: { selectedTargets: {}, selectedInputs: {}, influenceTotal: 8 },
      rejected: { selectedTargets: null, selectedInputs: null, influenceTotal: 3 },
    }
    const expected = expectedByStatus[submission.status]

    // Assert
    const afterClosure = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedClosureObservationByTurn = {
      [initialView.turn]: {
        statuses: ["AWAITING_PROCESSING", "PROCESSING"],
        selectedTargets: expected.selectedTargets,
        selectedInputs: expected.selectedInputs,
      },
      [initialView.turn + 1]: {
        statuses: ["COLLECTING_ACTIONS"],
        selectedTargets: null,
        selectedInputs: null,
      },
    }
    const expectedClosureObservation = expectedClosureObservationByTurn[afterClosure.turn]
    Assert.isDefined(expectedClosureObservation)
    expect(expectedClosureObservation.statuses).toContain(afterClosure.turnStatus)
    const observedAction = afterClosure.actions.find(({ id }) => id === action.id)
    Assert.isDefined(observedAction)
    expect(observedAction.selectedTargets).toStrictEqual(expectedClosureObservation.selectedTargets)
    expect(observedAction.selectedInputs).toStrictEqual(expectedClosureObservation.selectedInputs)

    const successorView = await waitForCollectingSuccessor({ client: player.client, gameId, closedTurn: initialView.turn })
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })
})

async function assertBuildCount({
  playerView,
  player,
  strengthGameId,
  origin,
  clock,
  turnProcessor,
  turnsRepository,
}: AssertBuildCountInput): Promise<AssertBuildCountResult> {
  for (let buildCount = 0; buildCount < 5; buildCount += 1) {
    const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: strengthGameId,
      turn: playerView.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: origin.id },
        selectedInputs: {},
      },
    })
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId: strengthGameId,
      turn: playerView.turn,
    })
    playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
  }

  return { playerView }
}

async function assertCancelReplaceResults({
  player,
  strengthGameId,
  playerView,
  selectedThirtyAction,
  moveThree,
  sourceFleet,
  destination,
}: AssertCancelReplaceResultsInput): Promise<void> {
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: strengthGameId,
    turn: playerView.turn,
    submittedActionTargets: { actionId: selectedThirtyAction.id, selectedTargets: null, selectedInputs: null },
  })

  // Cancel and replace the same instance concurrently; PostgreSQL may serialize either
  // mutation first, so the persisted selection and reservations must match one complete
  // serialized outcome rather than client response order.
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: strengthGameId,
    turn: playerView.turn,
    submittedActionTargets: {
      actionId: moveThree.id,
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 20 },
    },
  })
  const cancelReplaceGate = createStartGate(2)
  const cancelReplaceResults = await Promise.allSettled([
    (async (): Promise<void> => {
      await cancelReplaceGate()
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: strengthGameId,
        turn: playerView.turn,
        submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
      })
    })(),
    (async (): Promise<void> => {
      await cancelReplaceGate()
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: strengthGameId,
        turn: playerView.turn,
        submittedActionTargets: {
          actionId: moveThree.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 19 },
        },
      })
    })(),
  ])
  expect(cancelReplaceResults.every(({ status }) => status === "fulfilled")).toBe(true)
}

async function assertPersistedCancelReplaceState({
  moveThreeAfterRace,
  afterCancelReplace,
  sourceFleet,
  destination,
  player,
  strengthGameId,
  playerView,
  moveThree,
  moveOne,
  moveTwo,
}: AssertPersistedCancelReplaceStateInput): Promise<void> {
  const persistedCancelReplaceState = {
    selectedTargets: moveThreeAfterRace.selectedTargets,
    selectedInputs: moveThreeAfterRace.selectedInputs,
    influenceUncommitted: afterCancelReplace.resources[ResourceType.INFLUENCE].uncommitted,
    fuelUncommitted: afterCancelReplace.resources[ResourceType.FUEL].uncommitted,
  }
  expect([
    {
      selectedTargets: null,
      selectedInputs: null,
      influenceUncommitted: 6,
      fuelUncommitted: 2,
    },
    {
      selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
      selectedInputs: { strength: 19 },
      influenceUncommitted: 3,
      fuelUncommitted: 1,
    },
  ]).toContainEqual(persistedCancelReplaceState)
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId: strengthGameId,
    turn: playerView.turn,
    submittedActionTargets: { actionId: moveThree.id, selectedTargets: null, selectedInputs: null },
  })

  // Both 20 and 30 fit the 50-strength source and the exact 6 Influence / 2 Fuel budget.
  const twentyThirtyGate = createStartGate(2)
  const twentyThirtyResults = await Promise.allSettled([
    submitMoveAfterGate(twentyThirtyGate, {
      client: player.client,
      gameId: strengthGameId,
      turn: playerView.turn,
      actionId: moveOne.id,
      fleetId: sourceFleet.id,
      destinationId: destination.id,
      strength: 20,
    }),
    submitMoveAfterGate(twentyThirtyGate, {
      client: player.client,
      gameId: strengthGameId,
      turn: playerView.turn,
      actionId: moveTwo.id,
      fleetId: sourceFleet.id,
      destinationId: destination.id,
      strength: 30,
    }),
  ])
  expect(twentyThirtyResults.every(({ status }) => status === "fulfilled")).toBe(true)
}

async function assertMoveOneBeforeDeparture({
  moveOneBeforeDeparture,
  sourceFleet,
  destination,
  moveTwoBeforeDeparture,
  beforeDeparture,
  clock,
  turnProcessor,
  turnsRepository,
  player,
  strengthGameId,
  moveOne,
  moveTwo,
  origin,
}: AssertMoveOneBeforeDepartureInput): Promise<void> {
  expect(moveOneBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
  expect(moveOneBeforeDeparture.selectedInputs).toStrictEqual({ strength: 20 })
  expect(moveTwoBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
  expect(moveTwoBeforeDeparture.selectedInputs).toStrictEqual({ strength: 30 })
  expect(beforeDeparture.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
  expect(beforeDeparture.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })

  // Worker reloads both JSON fields from PostgreSQL; full force removes the original source row.
  await processManualDeadlineTurn({
    clock,
    turnProcessor,
    turnsRepository,
    client: player.client,
    gameId: strengthGameId,
    turn: beforeDeparture.turn,
  })
  const afterDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
  expect(afterDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  expect(afterDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
  expect(afterDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
  const departedStrengths = afterDeparture.fleets.map(({ movement }) => {
    Assert.isDefined(movement)
    const strength = movement.submission.selectedInputs[branded<InputTag>("strength")]
    Assert.isDefined(strength)
    return strength
  })
  expect(departedStrengths.toSorted((first, second) => first - second)).toStrictEqual([20, 30])
  for (const [action, strength] of [
    [moveOne, 20],
    [moveTwo, 30],
  ] as const) {
    const journey = afterDeparture.fleets.find(({ movement }) => movement?.submission.id === action.id)
    Assert.isDefined(journey)
    expect(journey).toMatchObject({
      strength,
      originPlanetId: origin.id,
      destinationPlanetId: destination.id,
      distanceToEnd: expect.closeTo(1.04564350459425, 12),
      movement: {
        speed: 0.1,
        departureTurn: beforeDeparture.turn,
        pendingArrivalEffects: [],
        submission: {
          id: action.id,
          playerId: player.account.id,
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength },
        },
      },
    })
  }
  expect(afterDeparture.actions.find(({ id }) => id === moveOne.id)?.isInProgress).toBe(true)
  expect(afterDeparture.actions.find(({ id }) => id === moveTwo.id)?.isInProgress).toBe(true)
}

async function assertSuccessorView({
  successorView,
  expected,
  player,
  gameId,
  initialView,
  action,
}: AssertSuccessorViewInput): Promise<void> {
  expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
  expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
    }),
  ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: initialView.turn,
      submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "CONFLICT" } })
}

type AssertBuildCountInput = {
  playerView: PlayerView
  player: AuthenticatedApiClient
  strengthGameId: GameId
  origin: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
}

type AssertBuildCountResult = { playerView: PlayerView }

type AssertCancelReplaceResultsInput = {
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  selectedThirtyAction: Action
  moveThree: Action
  sourceFleet: Fleet
  destination: Planet
}

type AssertPersistedCancelReplaceStateInput = {
  moveThreeAfterRace: Action
  afterCancelReplace: PlayerView
  sourceFleet: Fleet
  destination: Planet
  player: AuthenticatedApiClient
  strengthGameId: GameId
  playerView: PlayerView
  moveThree: Action
  moveOne: Action
  moveTwo: Action
}

type AssertMoveOneBeforeDepartureInput = {
  moveOneBeforeDeparture: Action
  sourceFleet: Fleet
  destination: Planet
  moveTwoBeforeDeparture: Action
  beforeDeparture: PlayerView
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  player: AuthenticatedApiClient
  strengthGameId: GameId
  moveOne: Action
  moveTwo: Action
  origin: Planet
}

type AssertSuccessorViewInput = {
  successorView: PlayerView
  expected:
    | { selectedTargets: null; selectedInputs: null; influenceTotal: number }
    | { selectedTargets: Record<string, never>; selectedInputs: Record<string, never>; influenceTotal: number }
  player: AuthenticatedApiClient
  gameId: GameId
  initialView: PlayerView
  action: Action
}
