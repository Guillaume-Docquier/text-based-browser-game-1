import { Assert, Logger, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { FleetName } from "shared/domain/world/fleets/FleetName.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetImproved, BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { SelectedTargets, SelectedInputs, Action, Planet, Fleet, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { actionsTable, fleetsTable, planetsTable, resourcesTable, turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  createFailureViewSetup as CapturedcreateFailureViewSetup,
  createAfterFailureSetup as CapturedcreateAfterFailureSetup,
  createClockSetup as CapturedcreateClockSetup,
  createTurnProcessorSetup as CapturedcreateTurnProcessorSetup,
  createAliceHomeSetup as CapturedcreateAliceHomeSetup,
  createRemainderJourneyIdSetup as CapturedcreateRemainderJourneyIdSetup,
} from "#tests/fleet-assertions/gameplay.worker-rollback.stages.ts"
import type {
  InvalidOwnerProjectionTurnsRepository as CapturedInvalidOwnerProjectionTurnsRepository,
  readColonizationPersistenceSnapshot as CapturedreadColonizationPersistenceSnapshot,
} from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { RetryActionInput } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { ProcessedTurnModel } from "#turn-processing/turns.repository.ts"
import {
  createClockSetup,
  createTurnProcessorSetup,
  createFailureViewSetup,
  createAfterFailureSetup,
  createAliceHomeSetup,
  createRemainderJourneyIdSetup,
} from "../../tests/fleet-assertions/gameplay.worker-rollback.stages.ts"
import { assertDefenderSource, assertAfterReset, assertJourney2 } from "../../tests/fleet-assertions/gameplay.worker-rollback.ts"
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
  PostgresArrivalAssaultRuleset,
  pendingAssaultCorruptions,
  pendingColonizeCorruptions,
  createPublicPendingAssaultFixture,
  createPublicPendingColonizeFixture,
  type GameplayRowsSnapshot,
  sortGameplayRows,
  findStationaryFleetAt,
  findMovingFleetForOwner,
  findPlayerResource,
} from "../../tests/fleet-concurrency/gameplay.ts"

describe("gameplay submission concurrency", () => {
  it("should restore and retry the real worker save exactly once after an invalid ownership projection", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const createClockSetupPhase1Result = await createClockSetup({ server })
    const { clock, player, defender, gameId, invalidOwnerPlayerId, expectedProjection } = createClockSetupPhase1Result
    const turnsRepository = new InvalidOwnerProjectionTurnsRepository({
      db: server.database,
      logger: Logger.get(),
      invalidOwnerPlayerId,
      beforeInvalidSave: async (processedTurn): Promise<void> => {
        await observeInvalidProjection({ processedTurn, gameId, expectedProjection, server })
      },
    })

    const createTurnProcessorSetupPhase2Result = await createTurnProcessorSetup({
      ...createClockSetupPhase1Result,
      server,
      turnsRepository,
    })
    const { turnProcessor, home } = createTurnProcessorSetupPhase2Result
    let { view, defenderView } = createTurnProcessorSetupPhase2Result

    const submitAndAdvanceTurn = async (
      actionDefinitionId: ActionDefinitionId,
      selectedTargets: DeepUnbranded<SubmittedActionTargetsDto["selectedTargets"]>,
      selectedInputs: DeepUnbranded<SubmittedActionTargetsDto["selectedInputs"]>,
    ): Promise<PlayerView> => {
      const action = view.actions.find(({ actionDefinitionId: definitionId }) => definitionId === actionDefinitionId)
      Assert.isDefined(action)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: view.turn,
        submittedActionTargets: { actionId: action.id, selectedTargets, selectedInputs },
      })
      await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: player.client, gameId, turn: view.turn })
      view = await player.client.gameplay.getPlayerView.query({ gameId })

      return view
    }

    await submitAndAdvanceTurn(BuildFleetImproved.id, { planet: home.id }, {})
    const source = findStationaryFleetAt(view, view.player.id, home.id)
    Assert.isDefined(source)
    expect(source.strength).toBe(100)

    const defenderAtTarget = await stageDefenderAtTarget({
      ...createClockSetupPhase1Result,
      ...createTurnProcessorSetupPhase2Result,
      turnsRepository,
      view,
      defenderView,
    })
    view = defenderAtTarget.view
    defenderView = defenderAtTarget.defenderView

    const createStagedDefenderSetupPhase1Result = await createStagedDefenderSetup({
      ...createClockSetupPhase1Result,
      ...createTurnProcessorSetupPhase2Result,
      defenderView,
      submitAndAdvanceTurn,
      source,
      view,
      turnsRepository,
    })

    let { movingFleet }: { movingFleet: Fleet | undefined } = createStagedDefenderSetupPhase1Result
    view = createStagedDefenderSetupPhase1Result.view
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

    const createCreateFailureViewSetupPhase3ResultSetupPhase2Result = await createCreateFailureViewSetupResultSetup({
      ...createStagedDefenderSetupPhase1Result,
      createClockSetupPhase1Result,
      createTurnProcessorSetupPhase2Result,
      movingFleet,
      view,
      source,
      server,
      turnsRepository,
    })
    const { createFailureViewSetupPhase3Result } = createCreateFailureViewSetupPhase3ResultSetupPhase2Result

    await verifyAfterFailure({
      ...createCreateFailureViewSetupPhase3ResultSetupPhase2Result,
      ...createClockSetupPhase1Result,
      ...createTurnProcessorSetupPhase2Result,
      ...createFailureViewSetupPhase3Result,
      turnsRepository,
      server,
      source,
      movingFleet,
    })
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

    const createCreateAliceHomeSetupPhase5ResultSetupPhase3Result = await createCreateAliceHomeSetupResultSetup({
      alice,
      gameId,
      bob,
      submit,
      processDeadlineTurn,
    })
    const {
      createAliceHomeSetupPhase5Result,
      aliceSource,
      bobDefender,
      friendlyGuard,
      assaultActionId,
      firstReload,
      journey,
      alternateDestination,
      remainderAction,
    } = createCreateAliceHomeSetupPhase5ResultSetupPhase3Result
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

    const createCreateRemainderJourneyIdSetupPhase6ResultSetupPhase4Result = await createCreateRemainderJourneyIdSetupResultSetup({
      ...createCreateAliceHomeSetupPhase5ResultSetupPhase3Result,
      expectedRemainders,
      advanceRemainderTurn,
      remainderSelectedView,
      processDeadlineTurn,
      alice,
      gameId,
    })
    const { createRemainderJourneyIdSetupPhase6Result } = createCreateRemainderJourneyIdSetupPhase6ResultSetupPhase4Result

    await verifyStationaryRemainder({
      ...createCreateAliceHomeSetupPhase5ResultSetupPhase3Result,
      ...createCreateRemainderJourneyIdSetupPhase6ResultSetupPhase4Result,
      ...createAliceHomeSetupPhase5Result,
      ...createRemainderJourneyIdSetupPhase6Result,
      processDeadlineTurn,
      alice,
      gameId,
    })
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

async function verifyActionSelections({
  defender,
  gameId,
  defenderView,
  defenderBuildAction,
  defenderHome,
  clock,
  turnProcessor,
  turnsRepository,
  view,
  player,
}: VerifyActionSelectionsInput): Promise<VerifyActionSelectionsResult> {
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

  return { view, defenderView }
}

async function verifyUpdatedVerifyDefenderSource({
  defenderSource,
  defenderHome,
  target,
  defender,
  gameId,
  defenderView,
  defenderMoveAction,
  clock,
  turnProcessor,
  turnsRepository,
  view,
  player,
}: VerifyUpdatedVerifyDefenderSourceInput): Promise<VerifyUpdatedVerifyDefenderSourceResult> {
  const updatedVerifyDefenderSource = await assertDefenderSource({
    defenderSource,
    defenderHome,
    target,
    defender,
    gameId,
    defenderView,
    defenderMoveAction,
    clock,
    turnProcessor,
    turnsRepository,
    view,
    player,
  })
  view = updatedVerifyDefenderSource.view
  defenderView = updatedVerifyDefenderSource.defenderView

  return { view, defenderView }
}

async function verifyAfterFailure({
  createAfterFailureSetupPhase4Result,
  failureView,
  expectedFailureActionInputs,
  turnsRepository,
  turnProcessor,
  player,
  gameId,
  defender,
  server,
  target,
  home,
  source,
  movingFleet,
  clock,
  untouchedGameId,
  invalidOwnerPlayerId,
  preSaveSnapshot,
}: VerifyAfterFailureInput): Promise<void> {
  await assertAfterReset({
    ...createAfterFailureSetupPhase4Result,
    failureView,
    expectedFailureActionInputs,
    turnsRepository,
    turnProcessor,
    player,
    gameId,
    defender,
    server,
    target,
    home,
    source,
    movingFleet,
    clock,
    untouchedGameId,
    invalidOwnerPlayerId,
    preSaveSnapshot,
  })
}

async function verifyAlternateDistance({
  alternateDistance,
  alice,
  gameId,
  firstReload,
  assaultActionId,
  aliceSource,
  bobHome,
  alternateDestination,
}: VerifyAlternateDistanceInput): Promise<void> {
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
}

async function verifyStationaryRemainder({
  stationaryRemainder,
  remainderJourneyId,
  remainderJourneyName,
  readyView,
  alternateDestination,
  afterRemainderArrival,
  remainderAction,
  friendlyGuard,
  processDeadlineTurn,
  alice,
  gameId,
  journey,
  bobDefender,
  assaultActionId,
}: VerifyStationaryRemainderInput): Promise<void> {
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
}

type VerifyActionSelectionsInput = {
  defender: AuthenticatedApiClient
  gameId: GameId
  defenderView: PlayerView
  defenderBuildAction: Action
  defenderHome: Planet
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  view: PlayerView
  player: AuthenticatedApiClient
}

type VerifyActionSelectionsResult = { view: PlayerView; defenderView: PlayerView }

type VerifyUpdatedVerifyDefenderSourceInput = {
  defenderSource: Fleet
  defenderHome: Planet
  target: Planet
  defender: AuthenticatedApiClient
  gameId: GameId
  defenderView: PlayerView
  defenderMoveAction: Action
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  view: PlayerView
  player: AuthenticatedApiClient
}

type VerifyUpdatedVerifyDefenderSourceResult = { view: PlayerView; defenderView: PlayerView }

type VerifyAfterFailureInput = {
  createAfterFailureSetupPhase4Result: Awaited<ReturnType<typeof CapturedcreateAfterFailureSetup>>
  failureView: PlayerView
  expectedFailureActionInputs: RetryActionInput[]
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: GameId
  defender: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  target: Planet
  home: Planet
  source: Fleet
  movingFleet: Fleet
  clock: ControlledClock
  untouchedGameId: GameId
  invalidOwnerPlayerId: PlayerId
  preSaveSnapshot: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
}

type VerifyAlternateDistanceInput = {
  alternateDistance: number
  alice: AuthenticatedApiClient
  gameId: GameId
  firstReload: PlayerView
  assaultActionId: string
  aliceSource: Fleet
  bobHome: Planet
  alternateDestination: Planet
}

type VerifyStationaryRemainderInput = {
  stationaryRemainder: Fleet
  remainderJourneyId: FleetId
  remainderJourneyName: FleetName
  readyView: PlayerView
  alternateDestination: Planet
  afterRemainderArrival: PlayerView
  remainderAction: Action
  friendlyGuard: Fleet
  processDeadlineTurn: (turn: number) => Promise<void>
  alice: AuthenticatedApiClient
  gameId: GameId
  journey: Fleet
  bobDefender: Fleet
  assaultActionId: string
}

async function createStagedDefenderSetup({
  defenderView,
  target,
  submitAndAdvanceTurn,
  source,
  view,
  clock,
  turnProcessor,
  turnsRepository,
  player,
  gameId,
}: CreateStagedDefenderSetupInput): Promise<CreateStagedDefenderSetupResult> {
  expect(findMovingFleetForOwner(defenderView, defenderView.player.id)).toBeUndefined()
  const stagedDefender = findStationaryFleetAt(defenderView, defenderView.player.id, target.id)
  Assert.isDefined(stagedDefender)
  expect(stagedDefender.strength).toBe(10)

  view = await submitAndAdvanceTurn(PostgresColonizeAssaultMove.id, { fleet: source.id, planet: target.id }, { strength: 35 })
  expect(view.turn).toBeGreaterThanOrEqual(5)
  expect(view.fleets.find(({ id }) => id === source.id)?.strength).toBe(65)
  const movingFleet = findMovingFleetForOwner(view, view.player.id)
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
  return { stagedDefender, movingFleet, view }
}

async function createCreateFailureViewSetupResultSetup({
  createClockSetupPhase1Result,
  createTurnProcessorSetupPhase2Result,
  movingFleet,
  view,
  stagedDefender,
  source,
  server,
  turnsRepository,
}: CreateCreateFailureViewSetupResultSetupInput): Promise<CreateCreateFailureViewSetupResultSetupResult> {
  const createFailureViewSetupPhase3Result = await createFailureViewSetup({
    ...createClockSetupPhase1Result,
    ...createTurnProcessorSetupPhase2Result,
    movingFleet,
    view,
    stagedDefender,
    source,
    server,
    turnsRepository,
  })

  const createAfterFailureSetupPhase4Result = await createAfterFailureSetup({
    ...createClockSetupPhase1Result,
    ...createTurnProcessorSetupPhase2Result,
    ...createFailureViewSetupPhase3Result,
    server,
    source,
    movingFleet,
    stagedDefender,
    turnsRepository,
  })
  return { createFailureViewSetupPhase3Result, createAfterFailureSetupPhase4Result }
}

async function createCreateAliceHomeSetupResultSetup({
  alice,
  gameId,
  bob,
  submit,
  processDeadlineTurn,
}: CreateCreateAliceHomeSetupResultSetupInput): Promise<CreateCreateAliceHomeSetupResultSetupResult> {
  const createAliceHomeSetupPhase5Result = await createAliceHomeSetup({ alice, gameId, bob, submit, processDeadlineTurn })
  const { aliceHome, bobHome, aliceSource, bobDefender, guardArrivalView, friendlyGuard } = createAliceHomeSetupPhase5Result

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

  assertJourney2({ ...createAliceHomeSetupPhase5Result, journey, assaultActionId, firstReload })

  // Assert: every edit form of the captured instance is rejected with the complete public state unchanged.
  const alternateDestination = findUnoccupiedUnclaimedAssaultDestination(firstReload, aliceHome, bobHome.id)
  Assert.isDefined(alternateDestination)
  const alternateDistance = Math.hypot(alternateDestination.x - aliceHome.x, alternateDestination.y - aliceHome.y)

  await verifyAlternateDistance({
    ...createAliceHomeSetupPhase5Result,
    alternateDistance,
    alice,
    gameId,
    firstReload,
    assaultActionId,
    alternateDestination,
  })

  // Act: a distinct pooled instance moves one source remainder to another legal public destination.
  const remainderAction = firstReload.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
  Assert.isDefined(remainderAction)
  return {
    createAliceHomeSetupPhase5Result,
    aliceSource,
    bobDefender,
    friendlyGuard,
    assaultActionId,
    firstReload,
    journey,
    alternateDestination,
    alternateDistance,
    remainderAction,
  }
}

async function createCreateRemainderJourneyIdSetupResultSetup({
  createAliceHomeSetupPhase5Result,
  expectedRemainders,
  advanceRemainderTurn,
  remainderSelectedView,
  remainderAction,
  alternateDestination,
  alternateDistance,
  processDeadlineTurn,
  alice,
  gameId,
  journey,
  assaultActionId,
}: CreateCreateRemainderJourneyIdSetupResultSetupInput): Promise<CreateCreateRemainderJourneyIdSetupResultSetupResult> {
  const createRemainderJourneyIdSetupPhase6Result = await createRemainderJourneyIdSetup({
    ...createAliceHomeSetupPhase5Result,
    expectedRemainders,
    advanceRemainderTurn,
    remainderSelectedView,
    remainderAction,
    alternateDestination,
    alternateDistance,
    processDeadlineTurn,
    alice,
    gameId,
    journey,
    assaultActionId,
  })
  const { remainderJourneyId, arrivalView } = createRemainderJourneyIdSetupPhase6Result

  // The later empty-destination arrival keeps the same child and releases its own pooled instance.
  await processDeadlineTurn(arrivalView.turn)
  const afterRemainderArrival = await alice.client.gameplay.getPlayerView.query({ gameId })
  const stationaryRemainder = afterRemainderArrival.fleets.find(({ id }) => id === remainderJourneyId)
  Assert.isDefined(stationaryRemainder)
  return { createRemainderJourneyIdSetupPhase6Result, afterRemainderArrival, stationaryRemainder }
}

type CreateStagedDefenderSetupInput = {
  defenderView: PlayerView
  target: Planet
  submitAndAdvanceTurn: (
    actionDefinitionId: ActionDefinitionId,
    selectedTargets: DeepUnbranded<SelectedTargets>,
    selectedInputs: DeepUnbranded<SelectedInputs>,
  ) => Promise<PlayerView>
  source: Fleet
  view: PlayerView
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
  player: AuthenticatedApiClient
  gameId: GameId
}

type CreateStagedDefenderSetupResult = { view: PlayerView; stagedDefender: Fleet; movingFleet: Fleet }

type CreateCreateFailureViewSetupResultSetupInput = {
  createClockSetupPhase1Result: Awaited<ReturnType<typeof CapturedcreateClockSetup>>
  createTurnProcessorSetupPhase2Result: Awaited<ReturnType<typeof CapturedcreateTurnProcessorSetup>>
  movingFleet: Fleet
  view: PlayerView
  stagedDefender: Fleet
  source: Fleet
  server: ConcurrencyTestApiServer
  turnsRepository: CapturedInvalidOwnerProjectionTurnsRepository
}

type CreateCreateFailureViewSetupResultSetupResult = {
  createFailureViewSetupPhase3Result: Awaited<ReturnType<typeof CapturedcreateFailureViewSetup>>
  createAfterFailureSetupPhase4Result: Awaited<ReturnType<typeof CapturedcreateAfterFailureSetup>>
}

type CreateCreateAliceHomeSetupResultSetupInput = {
  alice: AuthenticatedApiClient
  gameId: GameId
  bob: AuthenticatedApiClient
  submit: SubmitCallback
  processDeadlineTurn: (turn: number) => Promise<void>
}

type CreateCreateAliceHomeSetupResultSetupResult = {
  createAliceHomeSetupPhase5Result: Awaited<ReturnType<typeof CapturedcreateAliceHomeSetup>>
  aliceSource: Fleet
  bobDefender: Fleet
  friendlyGuard: Fleet
  assaultActionId: string
  firstReload: PlayerView
  journey: Fleet
  alternateDestination: Planet
  alternateDistance: number
  remainderAction: Action
}

type CreateCreateRemainderJourneyIdSetupResultSetupInput = {
  createAliceHomeSetupPhase5Result: Awaited<ReturnType<typeof CapturedcreateAliceHomeSetup>>
  expectedRemainders: number[]
  advanceRemainderTurn: (currentView: PlayerView, expectedRemainder: number) => Promise<PlayerView>
  remainderSelectedView: PlayerView
  remainderAction: Action
  alternateDestination: Planet
  alternateDistance: number
  processDeadlineTurn: (turn: number) => Promise<void>
  alice: AuthenticatedApiClient
  gameId: GameId
  journey: Fleet
  assaultActionId: string
}

type CreateCreateRemainderJourneyIdSetupResultSetupResult = {
  createRemainderJourneyIdSetupPhase6Result: Awaited<ReturnType<typeof CapturedcreateRemainderJourneyIdSetup>>
  afterRemainderArrival: PlayerView
  stationaryRemainder: Fleet
}

type SubmitCallback = (__0: {
  client: AuthenticatedApiClient["client"]
  view: PlayerView
  actionDefinitionId: ActionDefinitionId
  selectedTargets: DeepUnbranded<SelectedTargets>
  selectedInputs: DeepUnbranded<SelectedInputs>
}) => Promise<string>

type InvalidProjectionObservation = {
  processedTurn: ProcessedTurnModel
  gameId: GameId
  expectedProjection: Awaited<ReturnType<typeof createClockSetup>>["expectedProjection"]
  server: ConcurrencyTestApiServer
}
async function observeInvalidProjection({
  processedTurn,
  gameId,
  expectedProjection,
  server,
}: InvalidProjectionObservation): Promise<void> {
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
}
type DefenderStagingContext = Awaited<ReturnType<typeof createClockSetup>> &
  Awaited<ReturnType<typeof createTurnProcessorSetup>> & { turnsRepository: InvalidOwnerProjectionTurnsRepository }
async function stageDefenderAtTarget(context: DefenderStagingContext): Promise<Pick<DefenderStagingContext, "view" | "defenderView">> {
  const { clock, defender, player, gameId, defenderHome, turnProcessor, turnsRepository } = context
  let { view, defenderView } = context
  defenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
  const defenderBuildAction = defenderView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(defenderBuildAction)

  const updatedVerifyActionSelections = await verifyActionSelections({
    ...context,
    defenderView,
    defenderBuildAction,
    turnsRepository,
    view,
  })
  view = updatedVerifyActionSelections.view
  defenderView = updatedVerifyActionSelections.defenderView

  const defenderSource = findStationaryFleetAt(defenderView, defenderView.player.id, defenderHome.id)
  const defenderMoveAction = defenderView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
  Assert.isDefined(defenderSource)
  Assert.isDefined(defenderMoveAction)

  const updatedVerifyUpdatedVerifyDefenderSource = await verifyUpdatedVerifyDefenderSource({
    ...context,
    defenderSource,
    defenderView,
    defenderMoveAction,
    turnsRepository,
    view,
  })
  view = updatedVerifyUpdatedVerifyDefenderSource.view
  defenderView = updatedVerifyUpdatedVerifyDefenderSource.defenderView
  let defenderJourney = findMovingFleetForOwner(defenderView, defenderView.player.id)
  Assert.isDefined(defenderJourney)
  expect(defenderJourney.distanceToEnd).toBeCloseTo(12.497277624718329, 12)

  for (const remainingDistance of [7.497277624718329, 2.497277624718329]) {
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
    expect(defenderJourney.distanceToEnd).toBeCloseTo(remainingDistance, 12)
  }
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

  return { view, defenderView }
}
