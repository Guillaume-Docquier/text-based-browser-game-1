import { Logger, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { expect } from "vitest"
import type { Fleet, Planet, Action, SelectedTargets, SelectedInputs, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  readColonizationPersistenceSnapshot as CapturedreadColonizationPersistenceSnapshot,
  InvalidOwnerProjectionTurnsRepository as CapturedInvalidOwnerProjectionTurnsRepository,
} from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { RetryActionInput } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import { readColonizationPersistenceSnapshot, processManualDeadlineTurn } from "../fleet-concurrency/gameplay.scenarios.ts"
import {
  projectPersistedActionInputs,
  findPlanetOwnerInView,
  findStationaryFleetAt,
  findPlayerResource,
  hasFleetAtPlanet,
  areActionInstancesReleased,
  hasActionForTurn,
} from "../fleet-concurrency/gameplay.ts"

export async function assertDefenderSource({
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
}: AssertDefenderSourceInput): Promise<AssertDefenderSourceResult> {
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

  return { view, defenderView }
}

export type AssertDefenderSourceInput = {
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

export type AssertDefenderSourceResult = { view: PlayerView; defenderView: PlayerView }

export async function assertFindPlayerResource({
  preSaveSnapshot,
  failureView,
  source,
  movingFleet,
  stagedDefender,
  afterFailure,
  target,
  expectedFailureActionInputs,
  server,
  untouchedGameId,
  untouchedBefore,
}: AssertFindPlayerResourceInput): Promise<void> {
  assertFindPlayerResource2({ preSaveSnapshot, failureView, source, movingFleet, stagedDefender, afterFailure, target })
  const persistedFailureActionInputs = projectPersistedActionInputs(afterFailure, failureView.player.id, failureView.turn)
  expect(persistedFailureActionInputs).toStrictEqual(expectedFailureActionInputs)

  const untouchedAfter = await readColonizationPersistenceSnapshot(server.database, untouchedGameId)
  expect(untouchedAfter).toStrictEqual(untouchedBefore)
}

export type AssertFindPlayerResourceInput = {
  preSaveSnapshot: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  failureView: PlayerView
  source: Fleet
  movingFleet: Fleet
  stagedDefender: Fleet
  afterFailure: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  target: Planet
  expectedFailureActionInputs: RetryActionInput[]
  server: ConcurrencyTestApiServer
  untouchedGameId: GameId
  untouchedBefore: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
}

export type AssertFindPlayerResource2Input = {
  preSaveSnapshot: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  failureView: PlayerView
  source: Fleet
  movingFleet: Fleet
  stagedDefender: Fleet
  afterFailure: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  target: Planet
}

export function assertFindPlayerResource2({
  preSaveSnapshot,
  failureView,
  source,
  movingFleet,
  stagedDefender,
  afterFailure,
  target,
}: AssertFindPlayerResource2Input): void {
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

export async function assertAfterReset({
  afterReset,
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
  afterFailure,
}: AssertAfterResetInput): Promise<void> {
  expect(afterReset.turnsProcessing.find(({ turn }) => turn === failureView.turn)?.processingStartedAt).toBeNull()
  expect(afterReset.turnsProcessing.find(({ turn }) => turn === failureView.turn)?.processingEndedAt).toBeNull()
  const restoredFailureActionInputs = projectPersistedActionInputs(afterReset, failureView.player.id, failureView.turn)
  expect(restoredFailureActionInputs).toStrictEqual(expectedFailureActionInputs)

  turnsRepository.allowOwnershipChangesForRetry()
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const retryView = await player.client.gameplay.getPlayerView.query({ gameId })
  const retryDefenderView = await defender.client.gameplay.getPlayerView.query({ gameId })
  const afterRetry = await readColonizationPersistenceSnapshot(server.database, gameId)

  await verifyRetryView({
    retryView,
    failureView,
    target,
    home,
    source,
    movingFleet,
    retryDefenderView,
    afterRetry,
    turnProcessor,
    server,
    gameId,
  })

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

  assertEmptyView({ emptyView, emptyTurn, target, home, source, movingFleet, afterEmptyTurn, afterRetry, failureView })

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

export type AssertAfterResetInput = {
  afterReset: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
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
  afterFailure: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
}

export function assertEmptyView({
  emptyView,
  emptyTurn,
  target,
  home,
  source,
  movingFleet,
  afterEmptyTurn,
  afterRetry,
  failureView,
}: AssertEmptyViewInput): void {
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

export type AssertEmptyViewInput = {
  emptyView: PlayerView
  emptyTurn: number
  target: Planet
  home: Planet
  source: Fleet
  movingFleet: Fleet
  afterEmptyTurn: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  afterRetry: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  failureView: PlayerView
}

export async function assertMath({ aliceHome, bobHome, alice, gameId, bob, submit, processDeadlineTurn }: AssertMathInput): Promise<void> {
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

export type AssertMathInput = {
  aliceHome: Planet
  bobHome: Planet
  alice: AuthenticatedApiClient
  gameId: GameId
  bob: AuthenticatedApiClient
  submit: (__0: {
    client: AuthenticatedApiClient["client"]
    view: PlayerView
    actionDefinitionId: ActionDefinitionId
    selectedTargets: DeepUnbranded<SelectedTargets>
    selectedInputs: DeepUnbranded<SelectedInputs>
  }) => Promise<string>
  processDeadlineTurn: (turn: number) => Promise<void>
}

export function assertJourney2({
  journey,
  bobHome,
  assaultActionId,
  aliceSource,
  firstReload,
  bobDefender,
  friendlyGuard,
}: AssertJourney2Input): void {
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

export type AssertJourney2Input = {
  journey: Fleet
  bobHome: Planet
  assaultActionId: string
  aliceSource: Fleet
  firstReload: PlayerView
  bobDefender: Fleet
  friendlyGuard: Fleet
}

async function verifyRetryView({
  retryView,
  failureView,
  target,
  home,
  source,
  movingFleet,
  retryDefenderView,
  afterRetry,
  turnProcessor,
  server,
  gameId,
}: VerifyRetryViewInput): Promise<void> {
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
}

type VerifyRetryViewInput = {
  retryView: PlayerView
  failureView: PlayerView
  target: Planet
  home: Planet
  source: Fleet
  movingFleet: Fleet
  retryDefenderView: PlayerView
  afterRetry: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  turnProcessor: TurnProcessor
  server: ConcurrencyTestApiServer
  gameId: GameId
}
