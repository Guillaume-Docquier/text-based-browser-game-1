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

export async function assertJourney2(input: AssertJourney2Input): Promise<void> {
  expect(input.journey).toMatchObject({
    strength: 35,
    originPlanetId: input.home.id,
    destinationPlanetId: input.target.id,
    distanceToEnd: expect.closeTo(0.1456435045942517, 12),
    movement: {
      speed: 1,
      departureTurn: input.selectedView.turn,
      submission: {
        id: input.colonizeActionId,
        actionDefinitionId: ColonizePlanetTest.id,
        selectedTargets: { fleet: input.sourceFleet.id, planet: input.target.id },
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
  expect(input.sourceRemainder).toMatchObject({
    id: input.sourceFleet.id,
    name: input.sourceFleet.name,
    strength: 15,
    originPlanetId: input.home.id,
  })
  expect(getPlanets(input.departedView).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBeNull()
  expect(input.departedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
  expect(input.departedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(input.departedView.actions.find(({ id }) => id === input.colonizeActionId)?.isInProgress).toBe(true)

  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.departedView.turn,
      submittedActionTargets: {
        actionId: input.colonizeActionId,
        selectedTargets: { fleet: input.journey.id, planet: input.target.id },
        selectedInputs: { strength: 34 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.departedView.turn,
      submittedActionTargets: { actionId: input.colonizeActionId, selectedTargets: null, selectedInputs: null },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(input.departedView)
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

export async function assertReplayedArrival(input: AssertReplayedArrivalInput): Promise<void> {
  expect(input.replayedArrival.arrivedAtTick).toBe(3)

  const arrivedView = await processTurn({ ...input, client: input.player.client, turn: input.departedView.turn })
  const claimedFleet = getFleetAt(arrivedView, arrivedView.player.id, input.target.id, 15)
  expect(getPlanets(arrivedView).find(({ id }) => id === input.target.id)?.ownerPlayerId).toBe(arrivedView.player.id)
  expect(claimedFleet.strength).toBe(15)
  expect(claimedFleet.movement).toBeUndefined()
  expect(getFleetAt(arrivedView, arrivedView.player.id, input.home.id, 15)).toMatchObject({ id: input.sourceFleet.id })
  expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
  expect(arrivedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
  expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(arrivedView.actions.find(({ id }) => id === input.colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
  logReceipt("[C3-14 public natural route receipt]", {
    gameId: input.gameId,
    seed: 1234,
    player: arrivedView.player.id,
    home: { id: input.home.id, name: input.home.name, coordinates: input.home.coordinates, x: input.home.x, y: input.home.y },
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    routeDistance: 1.1456435045942517,
    buildSubmissions: 5,
    departure: {
      turn: input.selectedView.turn,
      selected: 35,
      sourceRemainder: 15,
      journeyForce: 35,
      remainingDistance: 0.1456435045942517,
    },
    arrival: { turn: arrivedView.turn, tick: 3, owner: arrivedView.player.id, targetForce: claimedFleet.strength },
    observedReplay: {
      source: "captured genuine worker input before real worker processing",
      inputTurn: input.arrivalInput.turn,
      arrivedAtTick: input.replayedArrival.arrivedAtTick,
    },
    resources: {
      influence: arrivedView.resources[ResourceType.INFLUENCE].total,
      fuel: arrivedView.resources[ResourceType.FUEL].total,
      colony: arrivedView.resources[ResourceType.COLONY].total,
    },
    pendingActionAfterDeparture: input.departedView.actions.find(({ id }) => id === input.colonizeActionId),
    releasedActionAfterArrival: arrivedView.actions.find(({ id }) => id === input.colonizeActionId),
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

export async function assertMoveDistance(input: AssertMoveDistanceInput): Promise<void> {
  expect({
    id: input.moveDestination.id,
    name: input.moveDestination.name,
    coordinates: input.moveDestination.coordinates,
    x: input.moveDestination.x,
    y: input.moveDestination.y,
  }).toStrictEqual({
    id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
    name: "planet 499054",
    coordinates: "45:98:25",
    x: 58.43825730690875,
    y: 49.61937512280339,
  })
  expect(input.moveDistance).toBeCloseTo(0.0002590998724286934, 12)
  await input.movePlayer.client.gameplay.updateActionSubmission.mutate({
    gameId: input.moveGameId,
    turn: input.moveColonizePending.turn,
    submittedActionTargets: {
      actionId: input.moveAction.id,
      selectedTargets: { fleet: input.sourceWithFifteen.id, planet: input.moveDestination.id },
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

export async function assertReplayedMovedFive(input: AssertReplayedMovedFiveInput): Promise<void> {
  expect(input.replayedMovedFive.arrivedAtTick).toBe(1)
  const bothInProgress = await processTurn({
    clock: input.moveClock,
    turnsRepository: input.moveTurns,
    turnProcessor: input.moveProcessor,
    client: input.movePlayer.client,
    gameId: input.moveGameId,
    turn: input.simultaneousSelections.turn,
  })
  expect(getPlanets(bothInProgress).find(({ id }) => id === input.moveFixture.target.id)?.ownerPlayerId).toBe(bothInProgress.player.id)
  expect(getFleetAt(bothInProgress, bothInProgress.player.id, input.moveHome.id, 10)).toMatchObject({ id: input.moveSource.id })
  const movedFive = getFleetAt(bothInProgress, bothInProgress.player.id, input.moveDestination.id, 5)
  expect(movedFive.ownerPlayerId).toBe(bothInProgress.player.id)
  expect(movedFive.movement).toBeUndefined()
  expect(movedFive.id).toBe(input.replayedMovedFive.id)
  expect(bothInProgress.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
  expect(bothInProgress.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
  expect(bothInProgress.actions.find(({ id }) => id === input.moveColonizeId)?.isInProgress).toBe(false)
  logReceipt("[C3-14 public reservation positive-control receipt]", {
    gameId: input.moveGameId,
    home: {
      id: input.moveHome.id,
      name: input.moveHome.name,
      coordinates: input.moveHome.coordinates,
      x: input.moveHome.x,
      y: input.moveHome.y,
    },
    moveDestination: {
      id: input.moveDestination.id,
      name: input.moveDestination.name,
      coordinates: input.moveDestination.coordinates,
      x: input.moveDestination.x,
      y: input.moveDestination.y,
      distance: input.moveDistance,
    },
    initialSource: 15,
    ordinaryMove: {
      actionContent: "independent TestRuleset Move Fleet Standard",
      selected: 5,
      remainingSource: 10,
      configuredSpeed: 0.1,
    },
    moveArrivalReplay: { inputTurn: input.moveInput.turn, arrivedAtTick: input.replayedMovedFive.arrivedAtTick },
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

export async function assertOutOfRangeDistance(input: AssertOutOfRangeDistanceInput): Promise<void> {
  verifyOutOfRangeDistance({ ...input })

  await verifyBeforeOutOfRangeAttempt({ ...input })

  await verifyQuotaThirtyView({ ...input })
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

export function assertActualWorkerInput2(input: AssertActualWorkerInput2Input): void {
  expect(input.actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id]).toMatchObject({
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
  expect(input.actualWorkerInput.submittedActions.find(({ id }) => id === input.seedOutpostAction.id)).toMatchObject({
    selectedTargets: { force: input.sourceFleet.id, site: input.target.id },
    selectedInputs: { quota: 45 },
  })
}

export type AssertActualWorkerInput2Input = {
  actualWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  seedOutpostAction: Action
  sourceFleet: Fleet
  target: Planet
}

export async function assertReplayedSeedFleet(options: AssertReplayedSeedFleetInput): Promise<void> {
  expect(options.replayedSeedFleet.arrivedAtTick).toBe(12)

  const resolvedView = await processTurn({ ...options, client: options.player.client, turn: options.selectedView.turn })
  const claimedFleet = getFleetAt(resolvedView, resolvedView.player.id, options.target.id, 15)
  expect(getPlanets(resolvedView).find(({ id }) => id === options.target.id)?.ownerPlayerId).toBe(resolvedView.player.id)
  expect(claimedFleet.strength).toBe(15)
  expect(claimedFleet.movement).toBeUndefined()
  expect(getFleetAt(resolvedView, resolvedView.player.id, options.home.id, 5)).toMatchObject({ id: options.sourceFleet.id })
  expect(resolvedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 43, uncommitted: 43 })
  expect(resolvedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
  expect(resolvedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  expect(resolvedView.actions.find(({ id }) => id === options.seedOutpostAction.id)).toMatchObject({
    actionDefinitionId: SeedOutpost.id,
    selectedTargets: null,
    isInProgress: false,
  })
  logReceipt("[C3-20 public alternate natural-route receipt]", {
    gameId: options.gameId,
    seed: 1234,
    player: resolvedView.player.id,
    home: { id: options.home.id, name: options.home.name, coordinates: options.home.coordinates, x: options.home.x, y: options.home.y },
    target: {
      id: options.target.id,
      name: options.target.name,
      coordinates: options.target.coordinates,
      x: options.target.x,
      y: options.target.y,
    },
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
      inputTurn: options.actualWorkerInput.turn,
      arrivedAtTick: options.replayedSeedFleet.arrivedAtTick,
    },
    payment: { influence: 7, fuel: 2, remaining: { influence: 43, fuel: 8 } },
    loadedActionDefinition: options.actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id],
    loadedSubmission: options.actualWorkerInput.submittedActions.find(({ id }) => id === options.seedOutpostAction.id),
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

function verifyOutOfRangeDistance(input: VerifyOutOfRangeDistanceInput): void {
  expect({
    id: input.outOfRangeTarget.id,
    name: input.outOfRangeTarget.name,
    coordinates: input.outOfRangeTarget.coordinates,
    x: input.outOfRangeTarget.x,
    y: input.outOfRangeTarget.y,
  }).toStrictEqual({
    id: "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5",
    name: "planet 596186",
    coordinates: "54:18:10",
    x: 48.592171610357454,
    y: 51.996922937376276,
  })
  const outOfRangeDistance = Math.hypot(input.home.x - input.outOfRangeTarget.x, input.home.y - input.outOfRangeTarget.y)
  expect(outOfRangeDistance).toBeCloseTo(10.129282735155494, 12)
  expect(input.outOfRangeTarget.ownerPlayerId).toBeNull()
}

async function verifyBeforeOutOfRangeAttempt(input: VerifyBeforeOutOfRangeAttemptInput): Promise<void> {
  const beforeOutOfRangeAttempt = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.builtView.turn,
      submittedActionTargets: {
        actionId: input.seedOutpostAction.id,
        selectedTargets: { force: input.sourceFleet.id, site: input.outOfRangeTarget.id },
        selectedInputs: { quota: 30 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(beforeOutOfRangeAttempt)
  const unchangedAfterQuotaFailure = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  await expect(
    input.player.client.gameplay.updateActionSubmission.mutate({
      gameId: input.gameId,
      turn: input.builtView.turn,
      submittedActionTargets: {
        actionId: input.seedOutpostAction.id,
        selectedTargets: { force: input.sourceFleet.id, site: input.target.id },
        selectedInputs: { quota: 29 },
      },
    }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
  expect(await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })).toStrictEqual(unchangedAfterQuotaFailure)
}

async function verifyQuotaThirtyView(input: VerifyQuotaThirtyViewInput): Promise<void> {
  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.builtView.turn,
    submittedActionTargets: {
      actionId: input.seedOutpostAction.id,
      selectedTargets: { force: input.sourceFleet.id, site: input.target.id },
      selectedInputs: { quota: 30 },
    },
  })
  const quotaThirtyView = await input.player.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  expect(quotaThirtyView.actions.find(({ id }) => id === input.seedOutpostAction.id)).toMatchObject({
    actionDefinitionId: SeedOutpost.id,
    selectedTargets: { force: input.sourceFleet.id, site: input.target.id },
    selectedInputs: { quota: 30 },
  })
  expect(quotaThirtyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
  expect(quotaThirtyView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

  await input.player.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: quotaThirtyView.turn,
    submittedActionTargets: {
      actionId: input.seedOutpostAction.id,
      selectedTargets: { force: input.sourceFleet.id, site: input.target.id },
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
