import { Assert } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetImproved } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { v5 } from "uuid"
import { expect } from "vitest"
import type { Planet, Fleet, Action, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { replayObservedTurn as CapturedreplayObservedTurn } from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type {
  createPublicAssaultStagingFixture as CapturedcreatePublicAssaultStagingFixture,
  createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture,
} from "#tests/fleet-worker/TurnProcessor.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  normalizedOutcomeSequence,
  outcomeForOwner,
  ownerFleetForces,
  getActionToSubmintegrationTest,
} from "../fleet-worker/TurnProcessor.scenarios.ts"
import {
  TickFiveAttackMoveWorkerTest,
  TickTenAttackMoveWorkerTest,
  TickFifteenAttackMoveWorkerTest,
  HomeArrivalMergeRuleset,
  createPublicHomeArrivalFixture,
  createPublicAssaultStagingFixture,
} from "../fleet-worker/TurnProcessor.ts"
import { assertIndex2, assertSelectedView, assertPermuted } from "./TurnProcessor.assault-arithmetic-2.ts"
import { assertIndex, assertOwnerPublicForces } from "./TurnProcessor.assault-arithmetic.ts"

export async function createClientsSetup({ apiServer, db, clock }: CreateClientsSetupInput): Promise<CreateClientsSetupResult> {
  const clients = [
    await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" }),
    await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" }),
  ] as const
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const fixture = await createPublicAssaultStagingFixture({
    apiServer,
    clients,
    forces: [30, 20],
    stagingCoordinates: "44:98:05",
    targetOwnerFirst: true,
    turnProcessor,
    expectedRouteDistances: [0, 4.418312565270031],
  })
  const initialView = await fixture.clients[0]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  const target = initialView?.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  expect({
    source: [fixture.stagingPlanet.id, fixture.stagingPlanet.coordinates, fixture.stagingPlanet.x, fixture.stagingPlanet.y],
    target: [target.id, target.coordinates, target.x, target.y],
    distance: Math.hypot(target.x - fixture.stagingPlanet.x, target.y - fixture.stagingPlanet.y),
  }).toStrictEqual({
    source: ["ec56a9af-3995-521c-822d-84685a96fdc6", "44:98:05", 48.987456457561635, 49.880579392930315],
    target: ["57c1b320-c267-5c9b-a5a5-1b5a02823714", "45:83:40", 53.24122006799319, 48.68601626316641],
    distance: 4.418312565270031,
  })

  // Act: submit two distinct tick-priority Attack Moves and capture the production-parsed input for replay.
  const beforeViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  const definitions = [TickFiveAttackMoveWorkerTest, TickFifteenAttackMoveWorkerTest] as const
  const forces = [30, 20] as const
  const actionIds: string[] = []

  await assertIndex({ fixture, beforeViews, definitions, forces, actionIds, target })

  const currentTurn = beforeViews[0]
  Assert.isDefined(currentTurn)
  await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: currentTurn.turn, turnProcessor, process: false })
  const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: currentTurn.turn })
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)

  // Assert: A30 wins its tick-5 exchange, then the already destroyed B20 order completes Prevented at tick15.
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(observed.rngState)
  expect(permuted.rngState).toStrictEqual(observed.rngState)
  const firstFleet = fixture.stationed[0]
  return {
    clients,
    turnProcessor,
    turnsRepository,
    fixture,
    target,
    beforeViews,
    actionIds,
    currentTurn,
    observed,
    forward,
    permuted,
    firstFleet,
  }
}

export type CreateClientsSetupInput = { apiServer: ApiServer; db: Database; clock: ControlledClock }

export type CreateClientsSetupResult = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  target: Planet
  beforeViews: PlayerView[]
  actionIds: string[]
  currentTurn: PlayerView
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  firstFleet: undefined | Fleet
}

export type CreateClientsSetup2Input = { apiServer: ApiServer; db: Database; clock: ControlledClock }

export type CreateClientsSetup2Result = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  target: Planet
  beforeViews: PlayerView[]
  actionIds: string[]
  currentTurn: PlayerView
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  outcomes: Array<undefined | Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>>
}

export async function createEmptyTurnSetup({
  fixture,
  playerAId,
  currentTurn,
  firstActionId,
  firstFleet,
  playerBId,
  laterActionId,
  laterFleet,
  firstOutcome,
  target,
  laterOutcome,
  forward,
  permuted,
  turnProcessor,
  beforeViews,
  actionIds,
  observed,
}: CreateEmptyTurnSetupInput): Promise<CreateEmptyTurnSetupResult> {
  const firstJourneyId = v5(
    JSON.stringify([fixture.gameId, playerAId, currentTurn.turn, firstActionId, firstFleet.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  const laterJourneyId = v5(
    JSON.stringify([fixture.gameId, playerBId, currentTurn.turn, laterActionId, laterFleet.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  expect(firstOutcome).toStrictEqual({
    type: "RESOLVED",
    result: 'Fleet "' + firstFleet.name + '" exchanged 20 Strength with 20 enemy Strength at Planet "' + target.name + '"',
  })
  expect(laterOutcome).toStrictEqual({
    type: "PREVENTED",
    reason: `Attacking Fleet "${laterJourneyId}" was destroyed before its Assault`,
  })
  const expectedForces = { [playerAId]: [10], [playerBId]: [] }
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
  expect(ownerFleetForces(permuted.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
  expect(forward.resolved.removedFleetIds).toContain(laterFleet.id)
  expect(forward.resolved.removedFleetIds).toContain(laterJourneyId)

  // Act: resolve once through the actual production worker and inspect public state after save/reload.
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const afterViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )

  // Assert: persisted A10, paid costs, released pooled instances, and unchanged natural RNG survive the next empty turn.

  assertOwnerPublicForces({
    afterViews,
    fixture,
    target,
    expectedForces,
    firstFleet,
    firstJourneyId,
    playerAId,
    laterFleet,
    laterJourneyId,
    beforeViews,
    actionIds,
  })

  const emptyTurn = afterViews[0]
  Assert.isDefined(emptyTurn)

  const assertEmptyObservedPhase3Observed = observed
  return { emptyTurn, assertEmptyObservedPhase3Observed }
}

export type CreateEmptyTurnSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  playerAId: PlayerId
  currentTurn: PlayerView
  firstActionId: string
  firstFleet: Fleet
  playerBId: PlayerId
  laterActionId: string
  laterFleet: Fleet
  firstOutcome: undefined | Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  target: Planet
  laterOutcome: undefined | Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  turnProcessor: TurnProcessor
  beforeViews: PlayerView[]
  actionIds: string[]
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
}

export type CreateEmptyTurnSetupResult = {
  emptyTurn: PlayerView
  assertEmptyObservedPhase3Observed: ReturnType<typeof reverseWorkerInputEnumeration>
}

export async function createClientsSetup2({ apiServer, db, clock }: CreateClientsSetup2Input): Promise<CreateClientsSetup2Result> {
  const clients = [
    await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" }),
    await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" }),
    await apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000003" }),
  ] as const
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
  const fixture = await createPublicAssaultStagingFixture({
    apiServer,
    clients,
    forces: [10, 30, 20],
    stagingCoordinates: "44:98:05",
    targetOwnerFirst: false,
    turnProcessor,
    expectedRouteDistances: [2.671241249775721, 16.366911301283746, 6.3383734351009045],
  })
  expect(fixture.stagingPlanet.ownerPlayerId).toBeNull()
  const initialView = await fixture.clients[0]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  const target = initialView?.galaxy.systems.flatMap(({ planets }) => planets).find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  expect(Math.hypot(target.x - fixture.stagingPlanet.x, target.y - fixture.stagingPlanet.y)).toBe(4.418312565270031)
  expect(fixture.stationed.map(({ strength }) => strength)).toStrictEqual([10, 30, 20])

  // Act: submit each public speed once and replay the exact captured input with reversed DB/property enumeration.
  const beforeViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  const definitions = [TickFiveAttackMoveWorkerTest, TickTenAttackMoveWorkerTest, TickFifteenAttackMoveWorkerTest] as const
  const forces = [10, 30, 20] as const
  const actionIds: string[] = []

  await assertIndex2({ fixture, beforeViews, definitions, forces, actionIds, target })

  const currentTurn = beforeViews[0]
  Assert.isDefined(currentTurn)
  await processPublicTurn({ clients: fixture.clients, gameId: fixture.gameId, turn: currentTurn.turn, turnProcessor, process: false })
  const observed = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: currentTurn.turn })
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)

  // Assert: A10 exchanges against all50; B24 then fights C16; C's queued order completes Prevented.
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(observed.rngState)
  expect(permuted.rngState).toStrictEqual(observed.rngState)
  const outcomes = fixture.playerIds.map((playerId, index) => outcomeForOwner(forward.resolved, playerId, actionIds[index]))
  return {
    clients,
    turnProcessor,
    turnsRepository,
    fixture,
    target,
    beforeViews,
    actionIds,
    currentTurn,
    observed,
    forward,
    permuted,
    outcomes,
  }
}

export async function createFleetBSetup({
  fixture,
  actionIds,
  outcomes,
  currentTurn,
  target,
  forward,
  permuted,
  turnProcessor,
}: CreateFleetBSetupInput): Promise<CreateFleetBSetupResult> {
  const fleetA = fixture.stationed[0]
  const fleetB = fixture.stationed[1]
  const fleetC = fixture.stationed[2]
  const playerAId = fixture.playerIds[0]
  const playerBId = fixture.playerIds[1]
  const playerCId = fixture.playerIds[2]
  const thirdActionId = actionIds[2]
  Assert.isDefined(outcomes[0])
  Assert.isDefined(outcomes[1])
  Assert.isDefined(outcomes[2])
  Assert.isDefined(fleetA)
  Assert.isDefined(fleetB)
  Assert.isDefined(fleetC)
  Assert.isDefined(playerCId)
  Assert.isDefined(thirdActionId)
  const thirdJourneyId = v5(
    JSON.stringify([fixture.gameId, playerCId, currentTurn.turn, thirdActionId, fleetC.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  const secondActionId = actionIds[1]
  Assert.isDefined(playerBId)
  Assert.isDefined(secondActionId)
  const secondJourneyId = v5(
    JSON.stringify([fixture.gameId, playerBId, currentTurn.turn, secondActionId, fleetB.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  expect(outcomes[0]).toStrictEqual({
    type: "RESOLVED",
    result: 'Fleet "' + fleetA.name + '" exchanged 10 Strength with 50 enemy Strength at Planet "' + target.name + '"',
  })
  expect(outcomes[1]).toStrictEqual({
    type: "RESOLVED",
    result: 'Fleet "' + fleetB.name + '" exchanged 16 Strength with 16 enemy Strength at Planet "' + target.name + '"',
  })
  expect(outcomes[2]).toStrictEqual({
    type: "PREVENTED",
    reason: `Attacking Fleet "${thirdJourneyId}" was destroyed before its Assault`,
  })
  Assert.isDefined(playerAId)
  Assert.isDefined(playerBId)
  const expectedForces = { [playerAId]: [], [playerBId]: [8], [playerCId]: [] }
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
  expect(ownerFleetForces(permuted.resolved, fixture.playerIds, target.id)).toStrictEqual(expectedForces)
  expect(forward.resolved.removedFleetIds).toContain(fleetC.id)
  expect(forward.resolved.removedFleetIds).toContain(thirdJourneyId)

  // Act: the real worker independently persists final fleet rows and the next empty turn's RNG.
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  return { fleetB, fleetC, thirdJourneyId, secondJourneyId, expectedForces }
}

export type CreateFleetBSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  actionIds: string[]
  outcomes: Array<undefined | Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>>
  currentTurn: PlayerView
  target: Planet
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  turnProcessor: TurnProcessor
}

export type CreateFleetBSetupResult = {
  fleetB: Fleet
  fleetC: Fleet
  thirdJourneyId: string
  secondJourneyId: string
  expectedForces: Record<string, number[]>
}

export async function createFixtureSetup({ db, clock, apiServer }: CreateFixtureSetupInput): Promise<CreateFixtureSetupResult> {
  const fixture = await createPublicHomeArrivalFixture({
    db,
    clock,
    apiServer,
    ruleset: HomeArrivalMergeRuleset,
    aliceDepartureStrength: 33,
    bobDepartureStrength: 20,
  })
  const alice = fixture.clients[0]
  const bob = fixture.clients[1]
  const playerAId = fixture.playerIds[0]
  const playerBId = fixture.playerIds[1]
  const initialFriendly = fixture.aliceAtTarget
  const attackerSource = fixture.aliceAtSource
  const enemy = fixture.bobAtTarget
  Assert.isDefined(alice)
  Assert.isDefined(bob)
  Assert.isDefined(playerAId)
  Assert.isDefined(playerBId)
  Assert.isDefined(initialFriendly)
  Assert.isDefined(attackerSource)
  Assert.isDefined(enemy)
  expect([initialFriendly.strength, attackerSource.strength, enemy.strength]).toStrictEqual([7, 33, 20])

  // Act: reserve20 for Attack Move and5 for an ordinary same-speed Move from one Alice source.
  const departureView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  const attackAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
  const ordinaryAction = departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
  Assert.isDefined(attackAction)
  Assert.isDefined(ordinaryAction)

  await assertSelectedView({ alice, fixture, departureView, attackerSource })

  const movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  const attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
  const ordinaryJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === ordinaryAction.id)
  Assert.isDefined(attackJourney)
  Assert.isDefined(ordinaryJourney)
  expect([attackJourney.strength, attackJourney.distanceToEnd, ordinaryJourney.strength, ordinaryJourney.distanceToEnd]).toStrictEqual([
    20, 3.418312565270031, 5, 3.418312565270031,
  ])
  expect(movingView.fleets.find(({ id }) => id === attackerSource.id)?.strength).toBe(8)
  return {
    fixture,
    alice,
    playerAId,
    playerBId,
    initialFriendly,
    attackerSource,
    enemy,
    attackAction,
    ordinaryAction,
    movingView,
    attackJourney,
    ordinaryJourney,
  }
}

export type CreateFixtureSetupInput = { db: Database; clock: ControlledClock; apiServer: ApiServer }

export type CreateFixtureSetupResult = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  alice: AuthenticatedApiClient
  playerAId: PlayerId
  playerBId: PlayerId
  initialFriendly: Fleet
  attackerSource: Fleet
  enemy: Fleet
  attackAction: Action
  ordinaryAction: Action
  movingView: PlayerView
  attackJourney: Fleet
  ordinaryJourney: Fleet
}

export async function createBuildActionSetup({
  movingView,
  attackJourney,
  ordinaryJourney,
  alice,
  fixture,
  db,
  clock,
  playerAId,
  playerBId,
  enemy,
  attackAction,
}: CreateBuildActionSetupInput): Promise<CreateBuildActionSetupResult> {
  const beforeCombat = movingView
  const buildAction = beforeCombat.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(buildAction)
  expect(attackJourney.distanceToEnd).toBe(0.418312565270031)
  expect(ordinaryJourney.distanceToEnd).toBe(0.418312565270031)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: beforeCombat.turn,
    submittedActionTargets: getActionToSubmintegrationTest(beforeCombat, BuildFleetStandard.id, { planet: fixture.aliceHome.id }),
  })
  const beforeCombatViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: beforeCombat.turn,
    turnProcessor: fixture.turnProcessor,
    process: false,
  })
  const observed = await observeTurnAndRollback({
    db,
    clock,
    turnsRepository: fixture.turnsRepository,
    gameId: fixture.gameId,
    turn: beforeCombat.turn,
  })
  const forward = replayObservedTurn(observed, false)

  const assertPermutedPhase9Observed = observed

  assertPermuted({ assertPermutedPhase9Observed, playerAId, playerBId, forward, fixture, attackJourney, ordinaryJourney, enemy })

  const attackContinuations = forward.resolved.resolvedContinuations.filter(
    ({ originatingSubmission }) => originatingSubmission.playerId === playerAId && originatingSubmission.id === attackAction.id,
  )
  expect(attackContinuations).toHaveLength(1)
  const attackContinuation = attackContinuations[0]
  Assert.isDefined(attackContinuation)
  expect(attackContinuation.actionOutcomes).toHaveLength(3)
  const attackResults = attackContinuation.actionOutcomes.filter(
    (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
      outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
  )
  const movementResults = attackContinuation.actionOutcomes.filter(
    (outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" moved "),
  )
  const mergeResults = attackContinuation.actionOutcomes.filter(
    (outcome) => outcome.type === "RESOLVED" && outcome.result.includes(" arrived on ") && outcome.result.includes(" merged "),
  )
  expect(movementResults).toHaveLength(1)
  return { buildAction, beforeCombatViews, observed, forward, attackResults, mergeResults }
}

export type CreateBuildActionSetupInput = {
  movingView: PlayerView
  attackJourney: Fleet
  ordinaryJourney: Fleet
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  db: Database
  clock: ControlledClock
  playerAId: PlayerId
  playerBId: PlayerId
  enemy: Fleet
  attackAction: Action
}

export type CreateBuildActionSetupResult = {
  buildAction: Action
  beforeCombatViews: PlayerView[]
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  attackResults: Array<Readonly<{ type: "RESOLVED"; result: string }>>
  mergeResults: EffectOutcome[]
}
