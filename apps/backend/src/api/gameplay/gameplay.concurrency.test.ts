import { Assert, branded, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

const TURN_INTERVAL = Time.create(10, UnitOfTime.SECONDS)
const RULESET_ID_FOR_STRENGTH_RACES = "test_strength_concurrency"
const RULESET_ID_FOR_RESOURCE_RACE = "test_resource_concurrency"

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
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
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
      await processNextTurn({ clock, turnProcessor, turnsRepository })
      playerView = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    }

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
    const afterCancelReplace = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveThreeAfterRace = afterCancelReplace.actions.find(({ id }) => id === moveThree.id)
    Assert.isDefined(moveThreeAfterRace)
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
    const beforeDeparture = await player.client.gameplay.getPlayerView.query({ gameId: strengthGameId })
    const moveOneBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveOne.id)
    const moveTwoBeforeDeparture = beforeDeparture.actions.find(({ id }) => id === moveTwo.id)
    Assert.isDefined(moveOneBeforeDeparture)
    Assert.isDefined(moveTwoBeforeDeparture)
    expect(moveOneBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveOneBeforeDeparture.selectedInputs).toStrictEqual({ strength: 20 })
    expect(moveTwoBeforeDeparture.selectedTargets).toStrictEqual({ fleet: sourceFleet.id, planet: destination.id })
    expect(moveTwoBeforeDeparture.selectedInputs).toStrictEqual({ strength: 30 })
    expect(beforeDeparture.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
    expect(beforeDeparture.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })

    // Worker reloads both JSON fields from PostgreSQL; full force removes the original source row.
    await processNextTurn({ clock, turnProcessor, turnsRepository })
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

    // A separate resource-only race cannot spend the same Influence twice.
    const { createdGameId: resourceGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ResourceRaceRuleset.id,
        turnIntervalSeconds: Time.in(TURN_INTERVAL, UnitOfTime.SECONDS),
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
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
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
    expect(successorView.resources[ResourceType.INFLUENCE].total).toBe(expected.influenceTotal)
    expect(normalizeApiDate(successorView.turnEndsAt).getTime()).toBeGreaterThan(Date.now() + 5_000)

    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: {}, selectedInputs: {} },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
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
      rejected: { status: "rejected", reason: { data: { code: "BAD_REQUEST" } } },
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
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterRejectedEdits = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(afterRejectedEdits).toStrictEqual(successorView)
  })
})

const StrengthRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_STRENGTH_RACES,
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: "MOVE_FLEET_STANDARD_3", actionDefinitionId: MoveFleetStandard.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 2,
  },
})

const ResourceRaceRuleset = Ruleset.create({
  ...TestRuleset,
  id: RULESET_ID_FOR_RESOURCE_RACE,
  actionPool: [...TestRuleset.actionPool, { id: "BUILD_FLEET_STANDARD_2", actionDefinitionId: BuildFleetStandard.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 3,
    [ResourceType.METAL]: 2,
  },
})

async function processNextTurn({
  clock,
  turnProcessor,
  turnsRepository,
}: {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
}): Promise<void> {
  clock.increment({ time: Time.create(20, UnitOfTime.SECONDS) })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

function normalizeApiDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

async function waitForCollectingSuccessor({
  client,
  gameId,
  closedTurn,
}: {
  client: AuthenticatedApiClient["client"]
  gameId: number
  closedTurn: number
}): Promise<Awaited<ReturnType<AuthenticatedApiClient["client"]["gameplay"]["getPlayerView"]["query"]>>> {
  await expect
    .poll(
      async () => {
        const view = await client.gameplay.getPlayerView.query({ gameId })
        return { turn: view.turn, turnStatus: view.turnStatus }
      },
      { interval: 100, timeout: 12_000 },
    )
    .toStrictEqual({ turn: closedTurn + 1, turnStatus: "COLLECTING_ACTIONS" })

  return await client.gameplay.getPlayerView.query({ gameId })
}

function createStartGate(parties: number): () => Promise<void> {
  const gate = Promise.withResolvers<undefined>()
  let arrivals = 0
  return async () => {
    arrivals += 1
    if (arrivals === parties) {
      gate.resolve(undefined)
    }
    await gate.promise
  }
}

async function submitMoveAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    fleetId,
    destinationId,
    strength,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    fleetId: string
    destinationId: string
    strength: number
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: {
      actionId,
      selectedTargets: { fleet: fleetId, planet: destinationId },
      selectedInputs: { strength },
    },
  })
}

async function submitBuildAfterGate(
  waitAtStart: () => Promise<void>,
  {
    client,
    gameId,
    turn,
    actionId,
    planetId,
  }: {
    client: AuthenticatedApiClient["client"]
    gameId: number
    turn: number
    actionId: string
    planetId: string
  },
): Promise<void> {
  await waitAtStart()
  await client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn,
    submittedActionTargets: { actionId, selectedTargets: { planet: planetId }, selectedInputs: {} },
  })
}
