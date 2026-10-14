import { Assert, Logger, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetImproved, BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { GainInfluence } from "shared/testing/test-ruleset/action-definitions/gain-influence.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { actionsTable, fleetsTable, planetsTable, resourcesTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  readColonizationPersistenceSnapshot,
  InvalidOwnerProjectionTurnsRepository,
  findUnoccupiedUnclaimedAssaultDestination,
  markManualDeadlineDue,
  processManualDeadlineTurn,
} from "../../tests/fleet-concurrency/gameplay.scenarios.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  PostgresColonizeAssaultMove,
  PostgresColonizeSaveFailureRuleset,
  PostgresArrivalAssaultRuleset,
  pendingAssaultCorruptions,
  pendingColonizeCorruptions,
  createPublicPendingAssaultFixture,
  createPublicPendingColonizeFixture,
  type GameplayRowsSnapshot,
  sortGameplayRows,
  projectPlayerViewActionInputs,
  projectPersistedActionInputs,
  findPlanetOwnerInView,
  findStationaryFleetAt,
  findMovingFleetForOwner,
  findPlayerResource,
  hasFleetAtPlanet,
  areActionInstancesReleased,
  hasActionForTurn,
} from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should restore and retry the real worker save exactly once after an invalid ownership projection", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeSaveFailureRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000041" })
    const defender = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000042" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeSaveFailureRuleset.id,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await defender.client.games.join.mutate({ gameId })
    await player.client.games.startGame.mutate({ gameId })
    const { createdGameId: untouchedGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresColonizeSaveFailureRuleset.id,
        turnIntervalSeconds: Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: untouchedGameId })
    const invalidOwnerPlayerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000099")
    const expectedProjection: {
      preSaveSnapshot?: Awaited<ReturnType<typeof readColonizationPersistenceSnapshot>>
      homePlanetId?: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
      playerId?: PlayerId
      defenderFleetToDeleteId?: PlayerView["fleets"][number]["id"]
      homeFleetUpdate?: {
        id: PlayerView["fleets"][number]["id"]
        ownerPlayerId: PlayerId
        originPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
        strength: number
      }
      arrivalFleetUpdate?: {
        id: PlayerView["fleets"][number]["id"]
        ownerPlayerId: PlayerId
        originPlanetId: PlayerView["galaxy"]["systems"][number]["planets"][number]["id"]
        strength: number
      }
    } = {}
    const turnsRepository = new InvalidOwnerProjectionTurnsRepository({
      db: server.database,
      logger: Logger.get(),
      invalidOwnerPlayerId,
      beforeInvalidSave: async (processedTurn): Promise<void> => {
        expect(processedTurn.gameId).toBe(gameId)
        expect(processedTurn.planetOwnershipChanges).toHaveLength(1)
        const homePlanetId = expectedProjection.homePlanetId
        const playerId = expectedProjection.playerId
        const defenderFleetToDeleteId = expectedProjection.defenderFleetToDeleteId
        const homeFleetUpdate = expectedProjection.homeFleetUpdate
        const arrivalFleetUpdate = expectedProjection.arrivalFleetUpdate
        Assert.isDefined(homePlanetId)
        Assert.isDefined(playerId)
        Assert.isDefined(defenderFleetToDeleteId)
        Assert.isDefined(homeFleetUpdate)
        Assert.isDefined(arrivalFleetUpdate)
        expect(processedTurn.planetOwnershipChanges[0]?.planetId).toBe(homePlanetId)
        expect(processedTurn.planetOwnershipChanges[0]?.ownerPlayerId).toBe(playerId)
        expect(processedTurn.fleetIdsToDelete).toContain(defenderFleetToDeleteId)
        expect(processedTurn.fleetsToUpdate).toContainEqual(expect.objectContaining(homeFleetUpdate))
        expect(processedTurn.fleetsToUpdate).toContainEqual(expect.objectContaining(arrivalFleetUpdate))
        expect(findPlayerResource(processedTurn.playerResources, playerId, ResourceType.INFLUENCE)?.amount).toBe(22)
        expect(findPlayerResource(processedTurn.playerResources, playerId, ResourceType.METAL)?.amount).toBe(1)
        expectedProjection.preSaveSnapshot = await readColonizationPersistenceSnapshot(server.database, gameId)
      },
    })
    const { turnProcessor } = await createTurnProcessorStub({ db: server.database, clock, turnsRepository })

    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    let defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
    const defenderHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === defenderView.player.id)
    Assert.isDefined(home)
    Assert.isDefined(defenderHome)
    expect(home).toMatchObject({
      coordinates: "46:93:25",
      x: 63.22189724800524,
      y: 49.62838420494031,
    })
    const target = planets.find(({ id }) => id === "3992658e-fbf9-58e0-b7ee-70a57ca38381")
    Assert.isDefined(target)
    expect(target).toMatchObject({
      coordinates: "56:33:50",
      x: 63.12006530944588,
      y: 53.28310291556491,
    })
    expect(target.ownerPlayerId).toBeNull()
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(3.6561371141548142, 12)
    Logger.get().info("[C3-22 seeded natural retry route]", {
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
    })

    const submitAndAdvanceTurn = async (
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<void> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })
      view = await player.client.gameplay.getPlayerView.query({ gameId })
    }

    await submitAndAdvanceTurn(BuildFleetImproved.id, { planet: home.id }, {})
    const source = findStationaryFleetAt(view, view.player.id, home.id)
    Assert.isDefined(source)
    expect(source.strength).toBe(100)

    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    const defenderBuildAction = defenderView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(defenderBuildAction)
    await defender.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: defenderView.turn,
      submittedActionTargets: {
        actionId: defenderBuildAction.id,
        selectedTargets: { planet: defenderHome.id },
        selectedInputs: {},
      },
    })
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: defender.client,
      gameId,
      turn: defenderView.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })

    const defenderSource = findStationaryFleetAt(defenderView, defenderView.player.id, defenderHome.id)
    const defenderMoveAction = defenderView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
    Assert.isDefined(defenderSource)
    Assert.isDefined(defenderMoveAction)
    const verifyDefenderSourcePhase1 = async (): Promise<void> => {
      expect(defenderSource.strength).toBe(10)
      expect(defenderHome).toMatchObject({
        coordinates: "44:96:25",
        x: 46.15278531453192,
        y: 49.009213135673384,
      })
      const defenderRouteDistance = Math.hypot(defenderHome.x - target.x, defenderHome.y - target.y)
      expect(defenderRouteDistance).toBeCloseTo(17.49727762471833, 12)
      await defender.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: defenderView.turn,
        submittedActionTargets: {
          actionId: defenderMoveAction.id,
          selectedTargets: { fleet: defenderSource.id, planet: target.id },
          selectedInputs: { strength: defenderSource.strength },
        },
      })
      await processManualDeadlineTurn({
        clock,
        turnProcessor,
        turnsRepository,
        client: defender.client,
        gameId,
        turn: defenderView.turn,
      })
      view = await player.client.gameplay.getPlayerView.query({ gameId })
      defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    }
    await verifyDefenderSourcePhase1()
    let defenderJourney = findMovingFleetForOwner(defenderView, defenderView.player.id)
    Assert.isDefined(defenderJourney)
    expect(defenderJourney.distanceToEnd).toBeCloseTo(12.497277624718329, 12)

    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: defender.client,
      gameId,
      turn: defenderView.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    defenderJourney = findMovingFleetForOwner(defenderView, defenderView.player.id)
    Assert.isDefined(defenderJourney)
    expect(defenderJourney.distanceToEnd).toBeCloseTo(7.497277624718329, 12)

    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: defender.client,
      gameId,
      turn: defenderView.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    defenderJourney = findMovingFleetForOwner(defenderView, defenderView.player.id)
    Assert.isDefined(defenderJourney)
    expect(defenderJourney.distanceToEnd).toBeCloseTo(2.497277624718329, 12)

    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: defender.client,
      gameId,
      turn: defenderView.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    expect(findMovingFleetForOwner(defenderView, defenderView.player.id)).toBeUndefined()
    const stagedDefender = findStationaryFleetAt(defenderView, defenderView.player.id, target.id)
    Assert.isDefined(stagedDefender)
    expect(stagedDefender.strength).toBe(10)

    await submitAndAdvanceTurn(PostgresColonizeAssaultMove.id, { fleet: source.id, planet: target.id }, { strength: 35 })
    expect(view.turn).toBeGreaterThanOrEqual(5)
    expect(view.fleets.find(({ id }) => id === source.id)?.strength).toBe(65)
    let movingFleet = findMovingFleetForOwner(view, view.player.id)
    Assert.isDefined(movingFleet)
    Assert.isDefined(movingFleet.distanceToEnd)
    expect(movingFleet.distanceToEnd).toBeCloseTo(2.6561371141548142, 12)
    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId,
      turn: view.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    movingFleet = findMovingFleetForOwner(view, view.player.id)
    Assert.isDefined(movingFleet)
    Assert.isDefined(movingFleet.distanceToEnd)
    expect(movingFleet.distanceToEnd).toBeCloseTo(1.6561371141548142, 12)

    await processManualDeadlineTurn({
      clock,
      turnProcessor,
      turnsRepository,
      client: player.client,
      gameId,
      turn: view.turn,
    })
    view = await player.client.gameplay.getPlayerView.query({ gameId })
    defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
    movingFleet = findMovingFleetForOwner(view, view.player.id)
    Assert.isDefined(movingFleet)
    Assert.isDefined(movingFleet.distanceToEnd)
    expect(movingFleet.distanceToEnd).toBeCloseTo(0.6561371141548142, 12)
    Assert.isDefined(movingFleet.distanceToEnd)
    expect(movingFleet.distanceToEnd).toBeGreaterThan(0)
    expect(movingFleet.distanceToEnd).toBeLessThanOrEqual(1)
    expect(findPlanetOwnerInView(view, target.id)).toBeNull()
    expectedProjection.defenderFleetToDeleteId = stagedDefender.id
    expectedProjection.homePlanetId = target.id
    expectedProjection.playerId = view.player.id

    const influenceAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
    Assert.isDefined(influenceAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: { actionId: influenceAction.id, selectedTargets: {}, selectedInputs: {} },
    })
    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
    expectedProjection.homeFleetUpdate = {
      id: source.id,
      ownerPlayerId: view.player.id,
      originPlanetId: home.id,
      strength: 75,
    }
    expectedProjection.arrivalFleetUpdate = {
      id: movingFleet.id,
      ownerPlayerId: view.player.id,
      originPlanetId: target.id,
      strength: 5,
    }

    const failureView = await player.client.gameplay.getPlayerView.query({ gameId })
    const expectedFailureActionInputs = projectPlayerViewActionInputs(failureView)
    expect(expectedFailureActionInputs).toHaveLength(2)
    const untouchedBefore = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
    expect(untouchedBefore.planets.find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    await markManualDeadlineDue({ clock, turnsRepository })

    expect(await turnProcessor.processNextDueTurn()).toBe("failed")
    const preSaveSnapshot = expectedProjection.preSaveSnapshot
    Assert.isDefined(preSaveSnapshot)
    const afterFailure = await readColonizationPersistenceSnapshot(server.database, gameId)
    const verifyAssertFindPlayerResourceState1Phase2 = async (): Promise<void> => {
      const assertFindPlayerResourceState1 = (): void => {
        expect(findPlayerResource(preSaveSnapshot.resources, failureView.player.id, ResourceType.INFLUENCE)?.amount).toBe(19)
        expect(findPlayerResource(preSaveSnapshot.resources, failureView.player.id, ResourceType.METAL)?.amount).toBe(2)
        expect(preSaveSnapshot.fleets.find(({ id }) => id === source.id)?.strength).toBe(65)
        expect(preSaveSnapshot.fleets.find(({ id }) => id === movingFleet.id)?.strength).toBe(35)
        expect(preSaveSnapshot.fleets.find(({ id }) => id === stagedDefender.id)?.strength).toBe(10)
        expect(afterFailure).toStrictEqual(preSaveSnapshot)
        expect(findPlanetOwnerInView(failureView, target.id)).toBeNull()
        expect(afterFailure.resources).toStrictEqual(preSaveSnapshot.resources)
        expect(afterFailure.fleets).toStrictEqual(preSaveSnapshot.fleets)
        expect(afterFailure.turns.find(({ turn }) => turn === failureView.turn)).toMatchObject({
          turn: failureView.turn,
          status: TurnStatus.PROCESSING,
        })
        expect(afterFailure.turns.map(({ turn }) => turn).toSorted((first, second) => first - second)).toStrictEqual(
          Array.from({ length: failureView.turn }, (_, index) => index + 1),
        )
        expect(afterFailure.turnsProcessing.find(({ turn }) => turn === failureView.turn)).toMatchObject({
          turn: failureView.turn,
          processingEndedAt: null,
        })
        expect(hasActionForTurn(afterFailure.actions, failureView.turn + 1)).toBe(false)
      }
      assertFindPlayerResourceState1()
      const persistedFailureActionInputs = projectPersistedActionInputs(afterFailure, failureView.player.id, failureView.turn)
      expect(persistedFailureActionInputs).toStrictEqual(expectedFailureActionInputs)

      const untouchedAfter = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
      expect(untouchedAfter).toStrictEqual(untouchedBefore)
    }
    await verifyAssertFindPlayerResourceState1Phase2()

    Assert.isSuccess(await turnsRepository.resetProcessingAttempt({ gameId, turn: failureView.turn }))
    const afterReset = await readColonizationPersistenceSnapshot(server.database, gameId)
    expect(afterReset.actions).toStrictEqual(afterFailure.actions)
    expect(afterReset.fleets).toStrictEqual(afterFailure.fleets)
    expect(afterReset.planets).toStrictEqual(afterFailure.planets)
    expect(afterReset.resources).toStrictEqual(afterFailure.resources)
    const failedTurnRow = afterFailure.turns.find(({ turn }) => turn === failureView.turn)
    const resetTurnRow = afterReset.turns.find(({ turn }) => turn === failureView.turn)
    Assert.isDefined(failedTurnRow)
    Assert.isDefined(resetTurnRow)
    expect({
      rngGeneratorState: resetTurnRow.rngGeneratorState,
      rngSpareNormal: resetTurnRow.rngSpareNormal,
    }).toStrictEqual({
      rngGeneratorState: failedTurnRow.rngGeneratorState,
      rngSpareNormal: failedTurnRow.rngSpareNormal,
    })
    expect(resetTurnRow.status).toBe(TurnStatus.AWAITING_PROCESSING)
    const verifyAfterResetPhase3 = async (): Promise<void> => {
      expect(afterReset.turnsProcessing.find(({ turn }) => turn === failureView.turn)?.processingStartedAt).toBeNull()
      expect(afterReset.turnsProcessing.find(({ turn }) => turn === failureView.turn)?.processingEndedAt).toBeNull()
      const restoredFailureActionInputs = projectPersistedActionInputs(afterReset, failureView.player.id, failureView.turn)
      expect(restoredFailureActionInputs).toStrictEqual(expectedFailureActionInputs)

      turnsRepository.allowOwnershipChangesForRetry()
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const retryView = await player.client.gameplay.getPlayerView.query({ gameId })
      const retryDefenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
      const afterRetry = await readColonizationPersistenceSnapshot(server.database, gameId)
      expect(retryView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
      expect(retryView.turn).toBe(failureView.turn + 1)
      expect(findPlanetOwnerInView(retryView, target.id)).toBe(retryView.player.id)
      expect(findStationaryFleetAt(retryView, retryView.player.id, home.id)).toMatchObject({ id: source.id, strength: 75 })
      expect(findStationaryFleetAt(retryView, retryView.player.id, target.id)).toMatchObject({
        id: movingFleet.id,
        strength: 5,
      })
      expect(hasFleetAtPlanet(retryDefenderView, retryDefenderView.player.id, target.id)).toBe(false)
      expect(retryView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
      expect(retryView.resources[ResourceType.METAL]).toStrictEqual({ total: 1, uncommitted: 1 })
      expect(areActionInstancesReleased(retryView.actions)).toBe(true)
      expect(afterRetry.turns.find(({ turn }) => turn === failureView.turn)?.status).toBe(TurnStatus.COMPLETED)

      expect(await turnProcessor.processNextDueTurn()).toBe("idle")
      const afterNoDuePoll = await readColonizationPersistenceSnapshot(server.database, gameId)
      expect(afterNoDuePoll).toStrictEqual(afterRetry)

      const emptyTurn = retryView.turn
      await processManualDeadlineTurn({
        clock,
        turnProcessor,
        turnsRepository,
        client: player.client,
        gameId,
        turn: emptyTurn,
      })
      const emptyView = await player.client.gameplay.getPlayerView.query({ gameId })
      const afterEmptyTurn = await readColonizationPersistenceSnapshot(server.database, gameId)
      const assertEmptyViewState2 = (): void => {
        expect(emptyView.turn).toBe(emptyTurn + 1)
        expect(emptyView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
        expect(findPlanetOwnerInView(emptyView, target.id)).toBe(emptyView.player.id)
        expect(findStationaryFleetAt(emptyView, emptyView.player.id, home.id)).toMatchObject({ id: source.id, strength: 75 })
        expect(findStationaryFleetAt(emptyView, emptyView.player.id, target.id)).toMatchObject({
          id: movingFleet.id,
          strength: 5,
        })
        expect(emptyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
        expect(emptyView.resources[ResourceType.METAL]).toStrictEqual({ total: 1, uncommitted: 1 })
        expect(areActionInstancesReleased(emptyView.actions)).toBe(true)
        expect(afterEmptyTurn.fleets).toStrictEqual(afterRetry.fleets)
        expect(afterEmptyTurn.planets).toStrictEqual(afterRetry.planets)
        expect(afterEmptyTurn.resources).toStrictEqual(afterRetry.resources)
        expect(afterEmptyTurn.turns.find(({ turn }) => turn === failureView.turn)?.status).toBe(TurnStatus.COMPLETED)
        expect(afterEmptyTurn.turns.find(({ turn }) => turn === emptyTurn)?.status).toBe(TurnStatus.COMPLETED)
      }
      assertEmptyViewState2()

      Logger.get().info("[C3-22 invalid-owner rollback and retry receipt]", {
        gameId,
        untouchedGameId,
        target: { id: target.id, coordinates: target.coordinates, owner: findPlanetOwnerInView(emptyView, target.id) },
        input: {
          sourceStrength: 100,
          submittedAssaultColonizeStrength: 35,
          defendingStrength: 10,
          colonizationThreshold: 20,
          expectedArrivalStrength: 5,
          resources: { influence: 22, metal: 1 },
        },
        rollback: {
          structuralSnapshotAssertion: "afterFailure.toStrictEqual(preSaveSnapshot) passed",
          resetKeptRngState: true,
          restoredActions: afterReset.actions.filter(({ turn }) => turn === failureView.turn).length,
        },
        retry: {
          result: "processed",
          attackerHomeStrength: findStationaryFleetAt(emptyView, emptyView.player.id, home.id)?.strength,
          attackerTargetStrength: findStationaryFleetAt(emptyView, emptyView.player.id, target.id)?.strength,
          defenderRemainsAtTarget: hasFleetAtPlanet(retryDefenderView, retryDefenderView.player.id, target.id),
          immediateNoDuePoll: "idle",
          ordinaryEmptyTurn: emptyView.turn,
        },
        invalidOwnerPlayerId,
        preSaveTurnStatus: preSaveSnapshot.turns.find(({ turn }) => turn === failureView.turn)?.status,
        postFailureTurnStatus: afterFailure.turns.find(({ turn }) => turn === failureView.turn)?.status,
        nextActionStatuses: emptyView.actions.map(({ id, isInProgress, selectedTargets }) => ({ id, isInProgress, selectedTargets })),
      })
    }
    await verifyAfterResetPhase3()
  })

  it("should persist an Assault arrival, remove defeated rows, and merge survivors on fresh PostgreSQL", async () => {
    // Arrange: the real API process migrates and seeds a fresh PostgreSQL 18.4 database before public game setup.
    await using server = await ConcurrencyTestApiServer.create()
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresArrivalAssaultRuleset))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PostgresArrivalAssaultRuleset.id,
        nbSeats: 2,
        turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 147,
      }),
    })
    await bob.client.games.join.mutate({ gameId })
    await alice.client.games.startGame.mutate({ gameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    const submit = async ({
      client,
      view,
      actionDefinitionId,
      selectedTargets,
      selectedInputs,
    }: {
      client: AuthenticatedApiClient["client"]
      view: PlayerView
      actionDefinitionId: ActionDefinitionId
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>
    }): Promise<string> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      return action.id
    }

    const processDeadlineTurn = async (turn: number): Promise<void> => {
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn })
    }

    const initialView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const allPlanets = initialView.galaxy.systems.flatMap(({ planets }) => planets)
    const aliceHome = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
    const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
    const bobHome = bobView.galaxy.systems
      .flatMap(({ planets }) => planets)
      .find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
    Assert.isDefined(aliceHome)
    Assert.isDefined(bobHome)
    const verifyMathPhase4 = async (): Promise<void> => {
      expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
      expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

      // Act: create forces through submitted Build actions and actual saved worker turns.
      for (let buildTurn = 0; buildTurn < 2; buildTurn += 1) {
        const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const bobBuildView = await bob.client.gameplay.getPlayerView.query({ gameId })
        await submit({
          client: alice.client,
          view: aliceBuildView,
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: { planet: aliceHome.id },
          selectedInputs: {},
        })
        await submit({
          client: bob.client,
          view: bobBuildView,
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: { planet: bobHome.id },
          selectedInputs: {},
        })
        await processDeadlineTurn(aliceBuildView.turn)
      }
      for (let buildTurn = 0; buildTurn < 3; buildTurn += 1) {
        const aliceBuildView = await alice.client.gameplay.getPlayerView.query({ gameId })
        await submit({
          client: alice.client,
          view: aliceBuildView,
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: { planet: aliceHome.id },
          selectedInputs: {},
        })
        await processDeadlineTurn(aliceBuildView.turn)
      }
    }
    await verifyMathPhase4()

    const readyView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const aliceSource = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === aliceHome.id)
      .find(({ movement }) => movement === undefined)
    const bobDefender = readyView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(aliceSource)
    Assert.isDefined(bobDefender)
    expect(aliceSource.strength).toBe(50)
    expect(bobDefender.strength).toBe(20)

    // Arrange: move a seven-strength friendly fleet to the target through a public action for the merge survivor.
    await submit({
      client: alice.client,
      view: readyView,
      actionDefinitionId: MoveFleetExceptional.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 7 },
    })
    const guardDeparture = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(guardDeparture.resources[ResourceType.INFLUENCE].uncommitted).toBe(87)
    expect(guardDeparture.resources[ResourceType.FUEL].uncommitted).toBe(95)
    await processDeadlineTurn(readyView.turn)
    const guardArrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const friendlyGuard = guardArrivalView.fleets
      .filter(({ ownerPlayerId }) => ownerPlayerId === readyView.player.id)
      .filter(({ originPlanetId }) => originPlanetId === bobHome.id)
      .filter(({ strength }) => strength === 7)
      .find(({ movement }) => movement === undefined)
    Assert.isDefined(friendlyGuard)
    expect(friendlyGuard).toMatchObject({ strength: 7, originPlanetId: bobHome.id })
    expect(guardArrivalView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
    const sourceAfterGuard = guardArrivalView.fleets.find(({ id }) => id === aliceSource.id)
    Assert.isDefined(sourceAfterGuard)
    expect(sourceAfterGuard.strength).toBe(43)

    // Act: submit partial Attack Move, then inspect persisted movement JSON after each actual worker reload.
    const assaultActionId = await submit({
      client: alice.client,
      view: guardArrivalView,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
      selectedInputs: { strength: 30 },
    })
    const assaultSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(assaultSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 87, uncommitted: 82 })
    expect(assaultSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 94 })
    expect(assaultSelectedView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(43)

    await processDeadlineTurn(guardArrivalView.turn)
    const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId })
    const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === assaultActionId)
    Assert.isDefined(journey)
    const verifyAssertJourneyState1Phase5 = (): void => {
      const assertJourneyState1 = (): void => {
        expect(journey).toMatchObject({ strength: 30, distanceToEnd: 3.418312565270031, destinationPlanetId: bobHome.id })
        expect(journey.movement).toMatchObject({
          speed: 1,
          submission: {
            id: assaultActionId,
            actionDefinitionId: AttackMoveTest.id,
            selectedTargets: { fleet: aliceSource.id, planet: bobHome.id },
            selectedInputs: { strength: 30 },
          },
          pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
        })
        expect(firstReload.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
        expect(firstReload.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
        expect(firstReload.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(13)
        // Assert: the new collecting-turn row is blank while the journey retains its historical captured submission.
        expect(firstReload.actions.find(({ id }) => id === assaultActionId)).toMatchObject({
          selectedTargets: null,
          selectedInputs: null,
          isInProgress: true,
        })
        expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 82 })
        expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
      }
      assertJourneyState1()
    }
    verifyAssertJourneyState1Phase5()

    // Assert: every edit form of the captured instance is rejected with the complete public state unchanged.
    const alternateDestination = findUnoccupiedUnclaimedAssaultDestination(firstReload, aliceHome, bobHome.id)
    Assert.isDefined(alternateDestination)
    const alternateDistance = Math.hypot(alternateDestination.x - aliceHome.x, alternateDestination.y - aliceHome.y)
    expect(alternateDistance).toBeGreaterThan(4.418312565270031)
    expect(alternateDistance).toBeLessThanOrEqual(5)
    const rejectBusySubmission = async (
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<void> => {
      await expect(
        alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: firstReload.turn,
          submittedActionTargets: { actionId: assaultActionId, selectedTargets, selectedInputs },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
    }
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 29 })
    await rejectBusySubmission(null, null)
    await rejectBusySubmission({ fleet: aliceSource.id, planet: alternateDestination.id }, { strength: 29 })
    await rejectBusySubmission({ fleet: aliceSource.id, planet: bobHome.id }, { strength: 13 })

    // Act: a distinct pooled instance moves one source remainder to another legal public destination.
    const remainderAction = firstReload.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
    Assert.isDefined(remainderAction)
    await alice.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: firstReload.turn,
      submittedActionTargets: {
        actionId: remainderAction.id,
        selectedTargets: { fleet: aliceSource.id, planet: alternateDestination.id },
        selectedInputs: { strength: 1 },
      },
    })
    const remainderSelectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(remainderSelectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 77 })
    expect(remainderSelectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 93 })

    const expectedRemainders = [2.418312565270031, 1.418312565270031, 0.418312565270031]
    const advanceRemainderTurn = async (currentView: PlayerView, expectedRemainder: number): Promise<PlayerView> => {
      await processDeadlineTurn(currentView.turn)
      const nextView = await alice.client.gameplay.getPlayerView.query({ gameId })
      expect(nextView.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(expectedRemainder)
      expect(nextView.fleets.find(({ id }) => id === bobDefender.id)?.strength).toBe(20)
      expect(nextView.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(7)
      expect(nextView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(true)
      expect(nextView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
      expect(nextView.resources[ResourceType.INFLUENCE].total).toBe(77)
      expect(nextView.resources[ResourceType.FUEL].total).toBe(93)
      expect(nextView.fleets.find(({ id }) => id === aliceSource.id)?.strength).toBe(12)
      return nextView
    }
    const [firstExpectedRemainder, ...laterExpectedRemainders] = expectedRemainders
    Assert.isDefined(firstExpectedRemainder)
    let savedView = await advanceRemainderTurn(remainderSelectedView, firstExpectedRemainder)
    const remainderJourney = savedView.fleets.find(({ movement }) => movement?.submission.id === remainderAction.id)
    Assert.isDefined(remainderJourney)
    const remainderJourneyId = remainderJourney.id
    const remainderJourneyName = remainderJourney.name
    expect(remainderJourney).toMatchObject({
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderJourney.distanceToEnd).toBeCloseTo(alternateDistance - 1, 12)
    for (const expectedRemainder of laterExpectedRemainders) {
      savedView = await advanceRemainderTurn(savedView, expectedRemainder)
    }

    await processDeadlineTurn(savedView.turn)
    const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })

    // Assert: zero-strength enemy and merged incoming rows disappear; the named friendly survivor keeps its identity.
    expect(arrivalView.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(arrivalView.fleets.find(({ id }) => id === friendlyGuard.id)).toStrictEqual({
      id: friendlyGuard.id,
      name: friendlyGuard.name,
      ownerPlayerId: readyView.player.id,
      strength: 17,
      originPlanetId: bobHome.id,
    })
    expect(arrivalView.fleets.find(({ id }) => id === aliceSource.id)).toMatchObject({ strength: 12, originPlanetId: aliceHome.id })
    expect(arrivalView.actions.find(({ id }) => id === assaultActionId)?.isInProgress).toBe(false)
    Assert.isDefined(remainderJourneyId)
    Assert.isDefined(remainderJourneyName)
    expect(arrivalView.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(true)
    const remainderAtAssaultArrival = arrivalView.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(remainderAtAssaultArrival)
    expect(remainderAtAssaultArrival).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: aliceHome.id,
      destinationPlanetId: alternateDestination.id,
      movement: { pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }] },
    })
    expect(remainderAtAssaultArrival.distanceToEnd).toBeGreaterThan(0)
    expect(remainderAtAssaultArrival.distanceToEnd).toBeLessThanOrEqual(1)
    expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 77, uncommitted: 77 })
    expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 93, uncommitted: 93 })

    // The later empty-destination arrival keeps the same child and releases its own pooled instance.
    await processDeadlineTurn(arrivalView.turn)
    const afterRemainderArrival = await alice.client.gameplay.getPlayerView.query({ gameId })
    const stationaryRemainder = afterRemainderArrival.fleets.find(({ id }) => id === remainderJourneyId)
    Assert.isDefined(stationaryRemainder)
    expect(stationaryRemainder).toMatchObject({
      id: remainderJourneyId,
      name: remainderJourneyName,
      ownerPlayerId: readyView.player.id,
      strength: 1,
      originPlanetId: alternateDestination.id,
    })
    expect(stationaryRemainder.movement).toBeUndefined()
    expect(stationaryRemainder.destinationPlanetId).toBeUndefined()
    expect(afterRemainderArrival.actions.find(({ id }) => id === remainderAction.id)?.isInProgress).toBe(false)
    expect(afterRemainderArrival.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)

    await processDeadlineTurn(afterRemainderArrival.turn)
    const afterEmptyTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(afterEmptyTurn.fleets.find(({ id }) => id === friendlyGuard.id)?.strength).toBe(17)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === journey.id)).toBeUndefined()
    expect(afterEmptyTurn.fleets.find(({ id }) => id === stationaryRemainder.id)).toStrictEqual(stationaryRemainder)
    expect(afterEmptyTurn.fleets.find(({ id }) => id === bobDefender.id)).toBeUndefined()
    expect(afterEmptyTurn.actions.find(({ id }) => id === assaultActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(afterEmptyTurn.resources[ResourceType.INFLUENCE].total).toBe(77)
    expect(afterEmptyTurn.resources[ResourceType.FUEL].total).toBe(93)
    expect(afterEmptyTurn.actions.find(({ id }) => id === remainderAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  })

  it.each(pendingColonizeCorruptions)(
    "should reject a persisted captured Colonize $label before gameplay mutation on fresh PostgreSQL",
    async ({ corruptMovement }) => {
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicPendingColonizeFixture(server)
      const { playerId, gameId, pendingView, journey, turnProcessor, turnsRepository, clock } = fixture
      const persistedJourney = (await server.database.select().from(fleetsTable).where(eq(fleetsTable.id, journey.id)))[0]
      Assert.isDefined(persistedJourney)
      Assert.isDefined(persistedJourney.movement)
      expect(persistedJourney.movement).toStrictEqual(journey.movement)
      expect(persistedJourney.ownerPlayerId).toBe(playerId)
      expect(persistedJourney.movement.pendingArrivalEffects).toHaveLength(1)
      expect(persistedJourney.movement.pendingArrivalEffects[0]?.effectDefinition.type).toBe("FLEET_COLONIZE")

      const corruptMovementValue = corruptMovement(persistedJourney.movement)
      await server.database.update(fleetsTable).set({ movement: corruptMovementValue }).where(eq(fleetsTable.id, journey.id))
      await markManualDeadlineDue({ clock, turnsRepository })
      const dueTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const dueTurn = dueTurns.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(dueTurn)
      expect(dueTurn.status).toBe(TurnStatus.AWAITING_PROCESSING)

      const snapshotGameplayRows = async (): Promise<GameplayRowsSnapshot> => {
        const [fleets, resources, planets, actions] = await Promise.all([
          server.database.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
          server.database.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
          server.database.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
          server.database.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
        ])
        return {
          fleets: sortGameplayRows(fleets),
          resources: sortGameplayRows(resources),
          planets: sortGameplayRows(planets),
          actions: sortGameplayRows(actions),
        }
      }
      const gameplayBeforeFailure = await snapshotGameplayRows()
      const turnCountBeforeFailure = dueTurns.length
      expect(await turnProcessor.processNextDueTurn()).toBe("failed")
      expect(await snapshotGameplayRows()).toStrictEqual(gameplayBeforeFailure)

      const turnsAfterFailure = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      expect(turnsAfterFailure).toHaveLength(turnCountBeforeFailure)
      const failedTargetTurn = turnsAfterFailure.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(failedTargetTurn)
      expect(failedTargetTurn.status).toBe(TurnStatus.PROCESSING)
    },
  )

  it.each(pendingAssaultCorruptions)(
    "should reject a persisted $label before gameplay mutation on fresh PostgreSQL",
    async ({ corruptMovement, expectedFailedTurnStatus }) => {
      // Arrange: this isolated database receives a genuine public game, Build, and captured partial Attack Move.
      await using server = await ConcurrencyTestApiServer.create()
      const fixture = await createPublicPendingAssaultFixture(server)
      const { alicePlayerId, bobPlayerId, gameId, pendingView, capturedJourney, turnProcessor, turnsRepository, clock } = fixture

      const persistedJourney = (await server.database.select().from(fleetsTable).where(eq(fleetsTable.id, capturedJourney.id)))[0]
      Assert.isDefined(persistedJourney)
      Assert.isDefined(persistedJourney.movement)
      expect(persistedJourney.movement).toStrictEqual(capturedJourney.movement)
      expect(persistedJourney.ownerPlayerId).toBe(alicePlayerId)

      // Only the authentic captured movement JSON is fault-injected; fleet row ownership and gameplay setup stay public and intact.
      const corruptMovementValue = corruptMovement(persistedJourney.movement, bobPlayerId)
      await server.database.update(fleetsTable).set({ movement: corruptMovementValue }).where(eq(fleetsTable.id, capturedJourney.id))

      await markManualDeadlineDue({ clock, turnsRepository })

      const dueTurns = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      const dueTurn = dueTurns.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(dueTurn)
      expect(dueTurn.status).toBe(TurnStatus.AWAITING_PROCESSING)
      expect(dueTurns.map(({ turn }) => turn)).toContain(pendingView.turn)

      const snapshotGameplayRows = async (): Promise<GameplayRowsSnapshot> => {
        const [fleets, resources, planets, actions] = await Promise.all([
          server.database.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)),
          server.database.select().from(resourcesTable).where(eq(resourcesTable.gameId, gameId)),
          server.database.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)),
          server.database.select().from(actionsTable).where(eq(actionsTable.gameId, gameId)),
        ])
        return {
          fleets: sortGameplayRows(fleets),
          resources: sortGameplayRows(resources),
          planets: sortGameplayRows(planets),
          actions: sortGameplayRows(actions),
        }
      }
      const gameplayBeforeFailure = await snapshotGameplayRows()
      const turnCountBeforeFailure = dueTurns.length

      // Act: the actual TurnProcessor loads the persisted invalid journey and rejects this exact due turn.
      expect(await turnProcessor.processNextDueTurn()).toBe("failed")

      // Assert: gameplay rows match the pre-worker snapshot, and the exact target turn remains in processing.
      expect(await snapshotGameplayRows()).toStrictEqual(gameplayBeforeFailure)
      const turnsAfterFailure = await server.database.select().from(turnsTable).where(eq(turnsTable.gameId, gameId))
      expect(turnsAfterFailure).toHaveLength(turnCountBeforeFailure)
      const failedTargetTurn = turnsAfterFailure.find(({ turn }) => turn === pendingView.turn)
      Assert.isDefined(failedTargetTurn)
      expect(failedTargetTurn.status).toBe(expectedFailedTurnStatus)
    },
  )
})
