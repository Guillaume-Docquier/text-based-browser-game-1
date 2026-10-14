import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Fleet, Planet, PlayerView, Action } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { fleetsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { replayWorkerInputWithState as CapturedreplayWorkerInputWithState } from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicNaturalRouteFixture as CapturedcreatePublicNaturalRouteFixture } from "#tests/colonization/gameplay.colonization.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getPlanets, getFleetAt, processTurn } from "../colonization/gameplay.colonization.scenarios.ts"
import { SeedOutpost, logReceipt, playerIdFor } from "../colonization/gameplay.colonization.ts"
import { assertFindPlayerAction2 } from "./gameplay.colonization.stationary-2.ts"

export async function assertJourney2({
  journey,
  home,
  target,
  selectedView,
  colonizeActionId,
  sourceFleet,
  sourceRemainder,
  departedView,
  player,
  gameId,
}: AssertJourney2Input): Promise<void> {
  expect(journey).toMatchObject({
    strength: 35,
    originPlanetId: home.id,
    destinationPlanetId: target.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
    movement: {
      speed: 1,
      departureTurn: selectedView.turn,
      submission: {
        id: colonizeActionId,
        actionDefinitionId: ColonizePlanetTest.id,
        selectedTargets: { fleet: sourceFleet.id, planet: target.id },
        selectedInputs: { strength: 35 },
      },
      pendingArrivalEffects: [
        {
          definitionOrdinal: 2,
          effectDefinition: {
            type: "FLEET_COLONIZE",
            targets: {
              fleet: { actionTargetTag: "fleet" },
              planet: { actionTargetTag: "planet" },
            },
            parameters: { strengthRequirement: 20 },
          },
        },
      ],
    },
  })
  expect(sourceRemainder).toMatchObject({ id: sourceFleet.id, name: sourceFleet.name, strength: 15, originPlanetId: home.id })
  expect(getPlanets(departedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  expect(departedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
  expect(departedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(departedView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress).toBe(true)

  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: departedView.turn,
      submittedActionTargets: {
        actionId: colonizeActionId,
        selectedTargets: { fleet: journey.id, planet: target.id },
        selectedInputs: { strength: 34 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: departedView.turn,
      submittedActionTargets: { actionId: colonizeActionId, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(departedView)
}

export type AssertJourney2Input = {
  journey: Fleet
  home: Planet
  target: Planet
  selectedView: PlayerView
  colonizeActionId: string
  sourceFleet: Fleet
  sourceRemainder: Fleet
  departedView: PlayerView
  player: AuthenticatedApiClient
  gameId: number
}

export async function assertReplayedArrival({
  replayedArrival,
  clock,
  turnsRepository,
  turnProcessor,
  player,
  gameId,
  departedView,
  target,
  home,
  sourceFleet,
  colonizeActionId,
  selectedView,
  arrivalInput,
}: AssertReplayedArrivalInput): Promise<void> {
  expect(replayedArrival.arrivedAtTick).toBe(3)

  const arrivedView = await processTurn({
    clock,
    turnsRepository,
    turnProcessor,
    client: player.client,
    gameId,
    turn: departedView.turn,
  })
  const claimedFleet = getFleetAt(arrivedView, arrivedView.player.id, target.id, 15)
  expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(arrivedView.player.id)
  expect(claimedFleet.strength).toBe(15)
  expect(claimedFleet.movement).toBeUndefined()
  expect(getFleetAt(arrivedView, arrivedView.player.id, home.id, 15)).toMatchObject({ id: sourceFleet.id })
  expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
  expect(arrivedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(arrivedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  logReceipt("[C3-14 public natural route receipt]", {
    gameId,
    seed: 1234,
    player: arrivedView.player.id,
    home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    routeDistance: 1.1456435045942517,
    buildSubmissions: 5,
    departure: { turn: selectedView.turn, selected: 35, sourceRemainder: 15, journeyForce: 35, remainingDistance: 0.1456435045942517 },
    arrival: { turn: arrivedView.turn, tick: 3, owner: arrivedView.player.id, targetForce: claimedFleet.strength },
    observedReplay: {
      source: "captured genuine worker input before real worker processing",
      inputTurn: arrivalInput.turn,
      arrivedAtTick: replayedArrival.arrivedAtTick,
    },
    resources: {
      influence: arrivedView.resources[ResourceType.INFLUENCE].total,
      fuel: arrivedView.resources[ResourceType.FUEL].total,
      colony: arrivedView.resources[ResourceType.COLONY].total,
    },
    pendingActionAfterDeparture: departedView.actions.find(({ id }) => id === colonizeActionId),
    releasedActionAfterArrival: arrivedView.actions.find(({ id }) => id === colonizeActionId),
  })
}

export type AssertReplayedArrivalInput = {
  replayedArrival: ResolutionFleet
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: number
  departedView: PlayerView
  target: Planet
  home: Planet
  sourceFleet: Fleet
  colonizeActionId: string
  selectedView: PlayerView
  arrivalInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

export async function assertMoveDistance({
  moveDestination,
  moveDistance,
  movePlayer,
  moveGameId,
  moveColonizePending,
  moveAction,
  sourceWithFifteen,
}: AssertMoveDistanceInput): Promise<void> {
  expect({
    id: moveDestination.id,
    name: moveDestination.name,
    coordinates: moveDestination.coordinates,
    x: moveDestination.x,
    y: moveDestination.y,
  }).toStrictEqual({
    id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
    name: "planet 499054",
    coordinates: "45:98:25",
    x: 58.43825730690875,
    y: 49.61937512280339,
  })
  expect(moveDistance).toBeCloseTo(0.0002590998724286934, 12)
  await movePlayer.client.gameplay.updateActionSubmission.mutate({
    gameId: moveGameId,
    turn: moveColonizePending.turn,
    submittedActionTargets: {
      actionId: moveAction.id,
      selectedTargets: { fleet: sourceWithFifteen.id, planet: moveDestination.id },
      selectedInputs: { strength: 5 },
    },
  })
}

export type AssertMoveDistanceInput = {
  moveDestination: Planet
  moveDistance: number
  movePlayer: AuthenticatedApiClient
  moveGameId: number
  moveColonizePending: PlayerView
  moveAction: Action
  sourceWithFifteen: Fleet
}

export async function assertReplayedMovedFive({
  replayedMovedFive,
  moveClock,
  moveTurns,
  moveProcessor,
  movePlayer,
  moveGameId,
  simultaneousSelections,
  moveFixture,
  moveHome,
  moveSource,
  moveDestination,
  moveColonizeId,
  moveDistance,
  moveInput,
}: AssertReplayedMovedFiveInput): Promise<void> {
  expect(replayedMovedFive.arrivedAtTick).toBe(1)
  const bothInProgress = await processTurn({
    clock: moveClock,
    turnsRepository: moveTurns,
    turnProcessor: moveProcessor,
    client: movePlayer.client,
    gameId: moveGameId,
    turn: simultaneousSelections.turn,
  })
  expect(getPlanets(bothInProgress).find(({ id }) => id === moveFixture.target.id)?.ownerPlayerId).toBe(bothInProgress.player.id)
  expect(getFleetAt(bothInProgress, bothInProgress.player.id, moveHome.id, 10)).toMatchObject({ id: moveSource.id })
  const movedFive = getFleetAt(bothInProgress, bothInProgress.player.id, moveDestination.id, 5)
  expect(movedFive.ownerPlayerId).toBe(bothInProgress.player.id)
  expect(movedFive.movement).toBeUndefined()
  expect(movedFive.id).toBe(replayedMovedFive.id)
  expect(bothInProgress.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
  expect(bothInProgress.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
  expect(bothInProgress.actions.find(({ id }) => id === moveColonizeId)?.isInProgress).toBe(false)
  logReceipt("[C3-14 public reservation positive-control receipt]", {
    gameId: moveGameId,
    home: { id: moveHome.id, name: moveHome.name, coordinates: moveHome.coordinates, x: moveHome.x, y: moveHome.y },
    moveDestination: {
      id: moveDestination.id,
      name: moveDestination.name,
      coordinates: moveDestination.coordinates,
      x: moveDestination.x,
      y: moveDestination.y,
      distance: moveDistance,
    },
    initialSource: 15,
    ordinaryMove: {
      actionContent: "independent TestRuleset Move Fleet Standard",
      selected: 5,
      remainingSource: 10,
      configuredSpeed: 0.1,
    },
    moveArrivalReplay: { inputTurn: moveInput.turn, arrivedAtTick: replayedMovedFive.arrivedAtTick },
    colonizeInstanceRemainedLockedUntilResolution: true,
    resourcesAfterBothCosts: { influence: 22, fuel: 9 },
  })
}

export type AssertReplayedMovedFiveInput = {
  replayedMovedFive: ResolutionFleet
  moveClock: ControlledClock
  moveTurns: TurnsRepository
  moveProcessor: TurnProcessor
  movePlayer: AuthenticatedApiClient
  moveGameId: number
  simultaneousSelections: PlayerView
  moveFixture: Awaited<ReturnType<typeof CapturedcreatePublicNaturalRouteFixture>>
  moveHome: Planet
  moveSource: Fleet
  moveDestination: Planet
  moveColonizeId: string
  moveDistance: number
  moveInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

export async function assertOutOfRangeDistance({
  outOfRangeTarget,
  home,
  player,
  gameId,
  builtView,
  seedOutpostAction,
  sourceFleet,
  target,
}: AssertOutOfRangeDistanceInput): Promise<void> {
  verifyOutOfRangeDistance({ outOfRangeTarget, home })

  await verifyBeforeOutOfRangeAttempt({ player, gameId, builtView, seedOutpostAction, sourceFleet, outOfRangeTarget, target })

  await verifyQuotaThirtyView({ player, gameId, builtView, seedOutpostAction, sourceFleet, target })
}

export type AssertOutOfRangeDistanceInput = {
  outOfRangeTarget: Planet
  home: Planet
  player: AuthenticatedApiClient
  gameId: number
  builtView: PlayerView
  seedOutpostAction: Action
  sourceFleet: Fleet
  target: Planet
}

export function assertActualWorkerInput2({
  actualWorkerInput,
  seedOutpostAction,
  sourceFleet,
  target,
}: AssertActualWorkerInput2Input): void {
  expect(actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id]).toMatchObject({
    id: "TEST_SEED_OUTPOST",
    name: "Seed Outpost",
    tier: "IMPROVED",
    inputs: { quota: { type: "POSITIVE_INTEGER" } },
    effects: [
      {
        type: "FLEET_MOVE",
        targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
        inputs: { strength: { actionInputTag: "quota", inputType: "POSITIVE_INTEGER" } },
        parameters: { speed: 2 },
      },
      {
        type: "FLEET_COLONIZE",
        targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
        parameters: { strengthRequirement: 30 },
      },
    ],
  })
  expect(actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
    selectedTargets: { force: sourceFleet.id, site: target.id },
    selectedInputs: { quota: 45 },
  })
}

export type AssertActualWorkerInput2Input = {
  actualWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  seedOutpostAction: Action
  sourceFleet: Fleet
  target: Planet
}

export async function assertReplayedSeedFleet({
  replayedSeedFleet,
  clock,
  turnsRepository,
  turnProcessor,
  player,
  gameId,
  selectedView,
  target,
  home,
  sourceFleet,
  seedOutpostAction,
  actualWorkerInput,
}: AssertReplayedSeedFleetInput): Promise<void> {
  expect(replayedSeedFleet.arrivedAtTick).toBe(12)

  const resolvedView = await processTurn({
    clock,
    turnsRepository,
    turnProcessor,
    client: player.client,
    gameId,
    turn: selectedView.turn,
  })
  const claimedFleet = getFleetAt(resolvedView, resolvedView.player.id, target.id, 15)
  expect(getPlanets(resolvedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(resolvedView.player.id)
  expect(claimedFleet.strength).toBe(15)
  expect(claimedFleet.movement).toBeUndefined()
  expect(getFleetAt(resolvedView, resolvedView.player.id, home.id, 5)).toMatchObject({ id: sourceFleet.id })
  expect(resolvedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 43, uncommitted: 43 })
  expect(resolvedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
  expect(resolvedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(resolvedView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
    actionDefinitionId: SeedOutpost.id,
    selectedTargets: null,
    isInProgress: false,
  })
  logReceipt("[C3-20 public alternate natural-route receipt]", {
    gameId,
    seed: 1234,
    player: resolvedView.player.id,
    home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    routeDistance: 1.1456435045942517,
    definition: {
      id: SeedOutpost.id,
      name: SeedOutpost.name,
      tier: SeedOutpost.tier,
      tags: { fleet: "force", planet: "site", input: "quota" },
    },
    apiBoundary: { rejectedQuota: 29, acceptedQuota: 30, finalSelectedForce: 45 },
    arrival: { tick: 12, selectedForce: 45, targetForce: claimedFleet.strength, homeRemainder: 5 },
    observedReplay: {
      source: "captured genuine worker input before real worker processing",
      inputTurn: actualWorkerInput.turn,
      arrivedAtTick: replayedSeedFleet.arrivedAtTick,
    },
    payment: { influence: 7, fuel: 2, remaining: { influence: 43, fuel: 8 } },
    loadedActionDefinition: actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id],
    loadedSubmission: actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id),
  })
}

export type AssertReplayedSeedFleetInput = {
  replayedSeedFleet: ResolutionFleet
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  player: AuthenticatedApiClient
  gameId: number
  selectedView: PlayerView
  target: Planet
  home: Planet
  sourceFleet: Fleet
  seedOutpostAction: Action
  actualWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
}

export async function assertFindPlayerAction({
  assertAssertFindPlayerActionState1ResolvedPhase8Value1,
  workerInput,
  colonizeActionId,
  player,
  stationary,
  target,
  replay,
  turnProcessor,
  view,
  gameId,
  selectedView,
  server,
}: AssertFindPlayerActionInput): Promise<AssertFindPlayerActionResult> {
  const assertFindPlayerActionState1Resolved = assertAssertFindPlayerActionState1ResolvedPhase8Value1

  await assertFindPlayerAction2({
    workerInput,
    colonizeActionId,
    player,
    stationary,
    target,
    assertFindPlayerActionState1Resolved,
    replay,
    turnProcessor,
  })
  view = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(view.turn).toBe(selectedView.turn + 1)
  expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
  expect(view.fleets.filter(({ originPlanetId }) => originPlanetId === target.id)).toHaveLength(0)
  expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 93, uncommitted: 93 })
  expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
  expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(
    await server.database
      .select()
      .from(fleetsTable)
      .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
  ).not.toContainEqual(expect.objectContaining({ id: stationary.id }))

  return { view }
}

export type AssertFindPlayerActionInput = {
  assertAssertFindPlayerActionState1ResolvedPhase8Value1: ResolvedTurnState
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  colonizeActionId: string
  player: AuthenticatedApiClient
  stationary: Fleet
  target: Planet
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  turnProcessor: TurnProcessor
  view: PlayerView
  gameId: GameId
  selectedView: PlayerView
  server: ConcurrencyTestApiServer
}

export type AssertFindPlayerActionResult = { view: PlayerView }

export type AssertFindPlayerAction2Input = {
  workerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  colonizeActionId: string
  player: AuthenticatedApiClient
  stationary: Fleet
  target: Planet
  assertFindPlayerActionState1Resolved: ResolvedTurnState
  replay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  turnProcessor: TurnProcessor
}

function verifyOutOfRangeDistance({ outOfRangeTarget, home }: VerifyOutOfRangeDistanceInput): void {
  expect({
    id: outOfRangeTarget.id,
    name: outOfRangeTarget.name,
    coordinates: outOfRangeTarget.coordinates,
    x: outOfRangeTarget.x,
    y: outOfRangeTarget.y,
  }).toStrictEqual({
    id: "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5",
    name: "planet 596186",
    coordinates: "54:18:10",
    x: 48.592171610357454,
    y: 51.996922937376276,
  })
  const outOfRangeDistance = Math.hypot(home.x - outOfRangeTarget.x, home.y - outOfRangeTarget.y)
  expect(outOfRangeDistance).toBeCloseTo(10.129282735155494, 12)
  expect(outOfRangeTarget.ownerPlayerId).toBeNull()
}

async function verifyBeforeOutOfRangeAttempt({
  player,
  gameId,
  builtView,
  seedOutpostAction,
  sourceFleet,
  outOfRangeTarget,
  target,
}: VerifyBeforeOutOfRangeAttemptInput): Promise<void> {
  const beforeOutOfRangeAttempt = await player.client.gameplay.getPlayerView.query({ gameId })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: {
        actionId: seedOutpostAction.id,
        selectedTargets: { force: sourceFleet.id, site: outOfRangeTarget.id },
        selectedInputs: { quota: 30 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOutOfRangeAttempt)
  const unchangedAfterQuotaFailure = await player.client.gameplay.getPlayerView.query({ gameId })
  await expect(
    player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: builtView.turn,
      submittedActionTargets: {
        actionId: seedOutpostAction.id,
        selectedTargets: { force: sourceFleet.id, site: target.id },
        selectedInputs: { quota: 29 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(unchangedAfterQuotaFailure)
}

async function verifyQuotaThirtyView({
  player,
  gameId,
  builtView,
  seedOutpostAction,
  sourceFleet,
  target,
}: VerifyQuotaThirtyViewInput): Promise<void> {
  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: builtView.turn,
    submittedActionTargets: {
      actionId: seedOutpostAction.id,
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 30 },
    },
  })
  const quotaThirtyView = await player.client.gameplay.getPlayerView.query({ gameId })
  expect(quotaThirtyView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
    actionDefinitionId: SeedOutpost.id,
    selectedTargets: { force: sourceFleet.id, site: target.id },
    selectedInputs: { quota: 30 },
  })
  expect(quotaThirtyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
  expect(quotaThirtyView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

  await player.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: quotaThirtyView.turn,
    submittedActionTargets: {
      actionId: seedOutpostAction.id,
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 45 },
    },
  })
}

type VerifyOutOfRangeDistanceInput = { outOfRangeTarget: Planet; home: Planet }

type VerifyBeforeOutOfRangeAttemptInput = {
  player: AuthenticatedApiClient
  gameId: number
  builtView: PlayerView
  seedOutpostAction: Action
  sourceFleet: Fleet
  outOfRangeTarget: Planet
  target: Planet
}

type VerifyQuotaThirtyViewInput = {
  player: AuthenticatedApiClient
  gameId: number
  builtView: PlayerView
  seedOutpostAction: Action
  sourceFleet: Fleet
  target: Planet
}
