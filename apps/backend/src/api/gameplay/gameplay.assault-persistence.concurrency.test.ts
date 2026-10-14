import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  createResourceGameIdSetup,
  createResourceResultsSetup,
} from "../../tests/fleet-assertions/gameplay.assault-persistence.stages-2.ts"
import {
  assertSuccessorView,
  createClockSetup,
  createThirtyStrengthResultsSetup,
  createBeforeDepartureSetup,
} from "../../tests/fleet-assertions/gameplay.assault-persistence.stages.ts"
import {
  ComposedReservationRaceRuleset,
  processManualDeadlineTurn,
  normalizeApiDate,
  waitForCollectingSuccessor,
  createStartGate,
  submitActionAfterGate,
} from "../../tests/fleet-concurrency/gameplay.scenarios.ts"
import { TURN_INTERVAL, MANUAL_WORKER_TURN_INTERVAL } from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should serialize real PostgreSQL resource and fleet-strength reservations and round-trip departures", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()

    const createClockSetupPhase1Result = await createClockSetup({ server })

    // Act
    // Both independent 30-strength submissions start together; the turn-row lock permits one.

    const createThirtyStrengthResultsSetupPhase2Result = await createThirtyStrengthResultsSetup({ ...createClockSetupPhase1Result })
    const { thirtyStrengthResults, firstStrengthAction, secondStrengthAction, expectedThirtyStrengthSelectionByStatus } =
      createThirtyStrengthResultsSetupPhase2Result
    for (const [index, action] of [firstStrengthAction, secondStrengthAction].entries()) {
      const submission = thirtyStrengthResults[index]
      Assert.isDefined(submission)
      const expectedSelection = expectedThirtyStrengthSelectionByStatus[submission.status]
      expect(action.selectedTargets).toStrictEqual(expectedSelection.selectedTargets)
      expect(action.selectedInputs).toStrictEqual(expectedSelection.selectedInputs)
    }

    const createBeforeDepartureSetupPhase3Result = await createBeforeDepartureSetup({
      ...createClockSetupPhase1Result,
      ...createThirtyStrengthResultsSetupPhase2Result,
    })

    const createResourceGameIdSetupPhase4Result = await createResourceGameIdSetup({
      ...createClockSetupPhase1Result,
      ...createBeforeDepartureSetupPhase3Result,
    })

    const createResourceResultsSetupPhase5Result = await createResourceResultsSetup({
      ...createClockSetupPhase1Result,
      ...createResourceGameIdSetupPhase4Result,
    })
    const { resourceResults, firstBuildAfterRace, secondBuildAfterRace, expectedBuildSelectionByStatus } =
      createResourceResultsSetupPhase5Result
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
      submitActionAfterGate(startTogether, {
        client: player.client,
        submission: {
          gameId,
          turn: playerView.turn,
          submittedActionTargets: {
            actionId: moveAction.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 20 },
          },
        },
      }),
      submitActionAfterGate(startTogether, {
        client: player.client,
        submission: {
          gameId,
          turn: playerView.turn,
          submittedActionTargets: {
            actionId: attackAction.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 30 },
          },
        },
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
