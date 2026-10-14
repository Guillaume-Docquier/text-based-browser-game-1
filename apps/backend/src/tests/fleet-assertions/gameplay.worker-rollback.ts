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
  InvalidOwnerProjectionTurnsRepository,
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

export async function assertFindPlayerResource(input: AssertFindPlayerResourceInput): Promise<void> {
  assertFindPlayerResource2({ ...input })
  const persistedFailureActionInputs = projectPersistedActionInputs(input.afterFailure, input.failureView.player.id, input.failureView.turn)
  expect(persistedFailureActionInputs).toStrictEqual(input.expectedFailureActionInputs)

  const untouchedAfter = await readColonizationPersistenceSnapshot(input.server.database, input.untouchedGameId)
  expect(untouchedAfter).toStrictEqual(input.untouchedBefore)
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

export function assertFindPlayerResource2(input: AssertFindPlayerResource2Input): void {
  expect(findPlayerResource(input.preSaveSnapshot.resources, input.failureView.player.id, ResourceType.INFLUENCE)?.amount).toBe(19)
  expect(findPlayerResource(input.preSaveSnapshot.resources, input.failureView.player.id, ResourceType.METAL)?.amount).toBe(2)
  expect(input.preSaveSnapshot.fleets.find(({ id }) => id === input.source.id)?.strength).toBe(65)
  expect(input.preSaveSnapshot.fleets.find(({ id }) => id === input.movingFleet.id)?.strength).toBe(35)
  expect(input.preSaveSnapshot.fleets.find(({ id }) => id === input.stagedDefender.id)?.strength).toBe(10)
  expect(input.afterFailure).toStrictEqual(input.preSaveSnapshot)
  expect(findPlanetOwnerInView(input.failureView, input.target.id)).toBeNull()
  expect(input.afterFailure.resources).toStrictEqual(input.preSaveSnapshot.resources)
  expect(input.afterFailure.fleets).toStrictEqual(input.preSaveSnapshot.fleets)
  expect(input.afterFailure.turns.find(({ turn }) => turn === input.failureView.turn)).toMatchObject({
    turn: input.failureView.turn,
    status: TurnStatus.PROCESSING,
  })
  expect(input.afterFailure.turns.map(({ turn }) => turn).toSorted((first, second) => first - second)).toStrictEqual(
    Array.from({ length: input.failureView.turn }, (_, index) => index + 1),
  )
  expect(input.afterFailure.turnsProcessing.find(({ turn }) => turn === input.failureView.turn)).toMatchObject({
    turn: input.failureView.turn,
    processingEndedAt: null,
  })
  expect(hasActionForTurn(input.afterFailure.actions, input.failureView.turn + 1)).toBe(false)
}

export async function assertAfterReset(options: AssertAfterResetInput): Promise<void> {
  const retryDefenderViewSetup1 = await createRetryDefenderViewSetup({ ...options })
  const { retryDefenderView, emptyTurn } = retryDefenderViewSetup1
  await processManualDeadlineTurn({ ...options, client: options.player.client, turn: emptyTurn })
  const emptyView = await options.player.client.gameplay.getPlayerView.query({ gameId: options.gameId })
  const afterEmptyTurn = await readColonizationPersistenceSnapshot(options.server.database, options.gameId)

  assertEmptyView({ ...options, ...retryDefenderViewSetup1, emptyView, afterEmptyTurn })

  Logger.get().info("[C3-22 invalid-owner rollback and retry receipt]", {
    gameId: options.gameId,
    untouchedGameId: options.untouchedGameId,
    target: { id: options.target.id, coordinates: options.target.coordinates, owner: findPlanetOwnerInView(emptyView, options.target.id) },
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
      restoredActions: options.afterReset.actions.filter(({ turn }) => turn === options.failureView.turn).length,
    },
    retry: {
      result: "processed",
      attackerHomeStrength: findStationaryFleetAt(emptyView, emptyView.player.id, options.home.id)?.strength,
      attackerTargetStrength: findStationaryFleetAt(emptyView, emptyView.player.id, options.target.id)?.strength,
      defenderRemainsAtTarget: hasFleetAtPlanet(retryDefenderView, retryDefenderView.player.id, options.target.id),
      immediateNoDuePoll: "idle",
      ordinaryEmptyTurn: emptyView.turn,
    },
    invalidOwnerPlayerId: options.invalidOwnerPlayerId,
    preSaveTurnStatus: options.preSaveSnapshot.turns.find(({ turn }) => turn === options.failureView.turn)?.status,
    postFailureTurnStatus: options.afterFailure.turns.find(({ turn }) => turn === options.failureView.turn)?.status,
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

export function assertEmptyView(input: AssertEmptyViewInput): void {
  expect(input.emptyView.turn).toBe(input.emptyTurn + 1)
  expect(input.emptyView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  expect(findPlanetOwnerInView(input.emptyView, input.target.id)).toBe(input.emptyView.player.id)
  expect(findStationaryFleetAt(input.emptyView, input.emptyView.player.id, input.home.id)).toMatchObject({
    id: input.source.id,
    strength: 75,
  })
  expect(findStationaryFleetAt(input.emptyView, input.emptyView.player.id, input.target.id)).toMatchObject({
    id: input.movingFleet.id,
    strength: 5,
  })
  expect(input.emptyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
  expect(input.emptyView.resources[ResourceType.METAL]).toStrictEqual({ total: 1, uncommitted: 1 })
  expect(areActionInstancesReleased(input.emptyView.actions)).toBe(true)
  expect(input.afterEmptyTurn.fleets).toStrictEqual(input.afterRetry.fleets)
  expect(input.afterEmptyTurn.planets).toStrictEqual(input.afterRetry.planets)
  expect(input.afterEmptyTurn.resources).toStrictEqual(input.afterRetry.resources)
  expect(input.afterEmptyTurn.turns.find(({ turn }) => turn === input.failureView.turn)?.status).toBe(TurnStatus.COMPLETED)
  expect(input.afterEmptyTurn.turns.find(({ turn }) => turn === input.emptyTurn)?.status).toBe(TurnStatus.COMPLETED)
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

export async function assertMath(input: AssertMathInput): Promise<void> {
  expect([input.aliceHome.coordinates, input.bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect(Math.hypot(input.bobHome.x - input.aliceHome.x, input.bobHome.y - input.aliceHome.y)).toBe(4.418312565270031)

  // Act: create forces through submitted Build actions and actual saved worker turns.
  for (let buildTurn = 0; buildTurn < 2; buildTurn += 1) {
    const aliceBuildView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    const bobBuildView = await input.bob.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    await input.submit({
      client: input.alice.client,
      view: aliceBuildView,
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: input.aliceHome.id },
      selectedInputs: {},
    })
    await input.submit({
      client: input.bob.client,
      view: bobBuildView,
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: input.bobHome.id },
      selectedInputs: {},
    })
    await input.processDeadlineTurn(aliceBuildView.turn)
  }
  for (let buildTurn = 0; buildTurn < 3; buildTurn += 1) {
    const aliceBuildView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    await input.submit({
      client: input.alice.client,
      view: aliceBuildView,
      actionDefinitionId: BuildFleetStandard.id,
      selectedTargets: { planet: input.aliceHome.id },
      selectedInputs: {},
    })
    await input.processDeadlineTurn(aliceBuildView.turn)
  }
}

export type AssertMathInput = {
  aliceHome: Planet
  bobHome: Planet
  alice: AuthenticatedApiClient
  gameId: GameId
  bob: AuthenticatedApiClient
  submit: SubmitCallback
  processDeadlineTurn: (turn: number) => Promise<void>
}

export function assertJourney2(input: AssertJourney2Input): void {
  expect(input.journey).toMatchObject({ strength: 30, distanceToEnd: 3.418312565270031, destinationPlanetId: input.bobHome.id })
  expect(input.journey.movement).toMatchObject({
    speed: 1,
    submission: {
      id: input.assaultActionId,
      actionDefinitionId: AttackMoveTest.id,
      selectedTargets: { fleet: input.aliceSource.id, planet: input.bobHome.id },
      selectedInputs: { strength: 30 },
    },
    pendingArrivalEffects: [{ definitionOrdinal: 3, effectDefinition: { type: "FLEET_ASSAULT" } }],
  })
  expect(input.firstReload.fleets.find(({ id }) => id === input.bobDefender.id)?.strength).toBe(20)
  expect(input.firstReload.fleets.find(({ id }) => id === input.friendlyGuard.id)?.strength).toBe(7)
  expect(input.firstReload.fleets.find(({ id }) => id === input.aliceSource.id)?.strength).toBe(13)
  // Assert: the new collecting-turn row is blank while the journey retains its historical captured submission.
  expect(input.firstReload.actions.find(({ id }) => id === input.assaultActionId)).toMatchObject({
    selectedTargets: null,
    selectedInputs: null,
    isInProgress: true,
  })
  expect(input.firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 82, uncommitted: 82 })
  expect(input.firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 94, uncommitted: 94 })
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

async function verifyRetryView(input: VerifyRetryViewInput): Promise<void> {
  expect(input.retryView.turnStatus).toBe(TurnStatus.COLLECTING_ACTIONS)
  expect(input.retryView.turn).toBe(input.failureView.turn + 1)
  expect(findPlanetOwnerInView(input.retryView, input.target.id)).toBe(input.retryView.player.id)
  expect(findStationaryFleetAt(input.retryView, input.retryView.player.id, input.home.id)).toMatchObject({
    id: input.source.id,
    strength: 75,
  })
  expect(findStationaryFleetAt(input.retryView, input.retryView.player.id, input.target.id)).toMatchObject({
    id: input.movingFleet.id,
    strength: 5,
  })
  expect(hasFleetAtPlanet(input.retryDefenderView, input.retryDefenderView.player.id, input.target.id)).toBe(false)
  expect(input.retryView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
  expect(input.retryView.resources[ResourceType.METAL]).toStrictEqual({ total: 1, uncommitted: 1 })
  expect(areActionInstancesReleased(input.retryView.actions)).toBe(true)
  expect(input.afterRetry.turns.find(({ turn }) => turn === input.failureView.turn)?.status).toBe(TurnStatus.COMPLETED)

  expect(await input.turnProcessor.processNextDueTurn()).toBe("idle")
  const afterNoDuePoll = await readColonizationPersistenceSnapshot(input.server.database, input.gameId)
  expect(afterNoDuePoll).toStrictEqual(input.afterRetry)
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

async function createRetryDefenderViewSetup(input: CreateRetryDefenderViewSetupInput): Promise<CreateRetryDefenderViewSetupResult> {
  expect(input.afterReset.turnsProcessing.find(({ turn }) => turn === input.failureView.turn)?.processingStartedAt).toBeNull()
  expect(input.afterReset.turnsProcessing.find(({ turn }) => turn === input.failureView.turn)?.processingEndedAt).toBeNull()
  const restoredFailureActionInputs = projectPersistedActionInputs(input.afterReset, input.failureView.player.id, input.failureView.turn)
  expect(restoredFailureActionInputs).toStrictEqual(input.expectedFailureActionInputs)

  input.turnsRepository.allowOwnershipChangesForRetry()
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
  const retryView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const retryDefenderView = await input.defender.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const afterRetry = await readColonizationPersistenceSnapshot(input.server.database, input.gameId)

  await verifyRetryView({ ...input, retryView, retryDefenderView, afterRetry })

  const emptyTurn = retryView.turn
  return { retryDefenderView, afterRetry, emptyTurn }
}

type CreateRetryDefenderViewSetupInput = {
  afterReset: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  failureView: PlayerView
  expectedFailureActionInputs: RetryActionInput[]
  turnsRepository: InvalidOwnerProjectionTurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: GameId
  defender: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  target: Planet
  home: Planet
  source: Fleet
  movingFleet: Fleet
}

type CreateRetryDefenderViewSetupResult = {
  retryDefenderView: PlayerView
  afterRetry: Awaited<ReturnType<typeof CapturedreadColonizationPersistenceSnapshot>>
  emptyTurn: number
}

type SubmitCallback = (__0: {
  client: AuthenticatedApiClient["client"]
  view: PlayerView
  actionDefinitionId: ActionDefinitionId
  selectedTargets: DeepUnbranded<SelectedTargets>
  selectedInputs: DeepUnbranded<SelectedInputs>
}) => Promise<string>
