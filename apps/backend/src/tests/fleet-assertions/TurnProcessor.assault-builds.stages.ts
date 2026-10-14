import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { required } from "shared/testing/required.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Fleet, PlayerView, Action } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type {
  replayObservedTurn as CapturedreplayObservedTurn,
  mulberry32FirstDraw as Capturedmulberry32FirstDraw,
} from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type { createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture } from "#tests/fleet-worker/TurnProcessor.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  mulberry32FirstDraw,
  normalizedOutcomeSequence,
  ownerFleetForces,
  getActionToSubmintegrationTest,
} from "../fleet-worker/TurnProcessor.scenarios.ts"
import { HomeArrivalMergeRuleset, createPublicHomeArrivalFixture } from "../fleet-worker/TurnProcessor.ts"
import { assertOwnerFleetForces, assertReservedView, assertJourneyForces, assertReservedView2 } from "./TurnProcessor.assault-builds.ts"

export async function createFixtureSetup(input: CreateFixtureSetupInput): Promise<CreateFixtureSetupResult> {
  const fixture = await createPublicHomeArrivalFixture({
    ...input,
    ruleset: HomeArrivalMergeRuleset,
    aliceDepartureStrength: 0,
    bobDepartureStrength: 20,
    bobStartingStrength: 40,
  })
  const alice = fixture.clients[0]
  const bob = fixture.clients[1]
  const playerAId = fixture.playerIds[0]
  const playerBId = fixture.playerIds[1]
  const attackerSource = fixture.aliceAtTarget
  const defender = fixture.bobAtSource
  Assert.isDefined(alice)
  Assert.isDefined(bob)
  Assert.isDefined(playerAId)
  Assert.isDefined(playerBId)
  Assert.isDefined(attackerSource)
  Assert.isDefined(defender)
  expect([attackerSource.strength, defender.strength, required(fixture.bobAtTarget).strength]).toStrictEqual([40, 20, 20])
  expect(fixture.aliceAtSource).toBeUndefined()

  // Act: send Alice30 to Bob's home; the public Build action reinforces Bob's stationed20 on the arrival turn.
  const departureViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  const aliceDepartureView = departureViews[0]
  const bobDepartureView = departureViews[1]
  Assert.isDefined(aliceDepartureView)
  Assert.isDefined(bobDepartureView)
  const attackAction = aliceDepartureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
  Assert.isDefined(attackAction)
  const aliceBeforeDeparture = {
    influence: aliceDepartureView.resources[ResourceType.INFLUENCE].total,
    fuel: aliceDepartureView.resources[ResourceType.FUEL].total,
    metal: aliceDepartureView.resources[ResourceType.METAL].total,
  }
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: aliceDepartureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      aliceDepartureView,
      AttackMoveTest.id,
      { fleet: attackerSource.id, planet: fixture.bobHome.id },
      { strength: 30 },
    ),
  })
  return { fixture, alice, bob, playerAId, playerBId, attackerSource, defender, aliceDepartureView, attackAction, aliceBeforeDeparture }
}

export type CreateFixtureSetupInput = { db: Database; clock: ControlledClock; apiServer: ApiServer }

export type CreateFixtureSetupResult = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  playerAId: PlayerId
  playerBId: PlayerId
  attackerSource: Fleet
  defender: Fleet
  aliceDepartureView: PlayerView
  attackAction: Action
  aliceBeforeDeparture: { influence: number; fuel: number; metal: number }
}

export type CreateFixtureSetup2Input = { db: Database; clock: ControlledClock; apiServer: ApiServer }

export type CreateFixtureSetup2Result = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  alice: AuthenticatedApiClient
  playerAId: PlayerId
  playerBId: PlayerId
  source: Fleet
  defender: Fleet
  departureViews: PlayerView[]
  departureView: PlayerView
}

export type CreateFixtureSetup3Input = { db: Database; clock: ControlledClock; apiServer: ApiServer }

export type CreateFixtureSetup3Result = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  alice: AuthenticatedApiClient
  playerAId: PlayerId
  playerBId: PlayerId
  source: Fleet
  enemy: Fleet
  departureViews: PlayerView[]
  departureView: PlayerView
}

export async function createAttackJourneySetup(input: CreateAttackJourneySetupInput): Promise<CreateAttackJourneySetupResult> {
  await processPublicTurn({
    clients: input.fixture.clients,
    gameId: input.fixture.gameId,
    turn: input.aliceDepartureView.turn,
    turnProcessor: input.fixture.turnProcessor,
  })
  let movingView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  let attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === input.attackAction.id)
  Assert.isDefined(attackJourney)
  expect([attackJourney.strength, attackJourney.distanceToEnd]).toStrictEqual([30, 3.418312565270031])
  expect(required(movingView.fleets.find(({ id }) => id === input.attackerSource.id)).strength).toBe(10)
  for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
    await processPublicTurn({
      clients: input.fixture.clients,
      gameId: input.fixture.gameId,
      turn: movingView.turn,
      turnProcessor: input.fixture.turnProcessor,
    })
    movingView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
    attackJourney = movingView.fleets.find(({ id }) => id === attackJourney?.id)
    Assert.isDefined(attackJourney)
    expect(attackJourney.distanceToEnd).toBe(remainingDistance)
    expect(required(movingView.fleets.find(({ id }) => id === input.defender.id)).strength).toBe(20)
  }
  const beforeCombatViews = await Promise.all(
    input.fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })),
  )
  const aliceBeforeCombat = beforeCombatViews[0]
  const bobBeforeCombat = beforeCombatViews[1]
  Assert.isDefined(aliceBeforeCombat)
  Assert.isDefined(bobBeforeCombat)
  const buildAction = bobBeforeCombat.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(buildAction)
  await input.bob.client.gameplay.updateActionSubmission.mutate({
    gameId: input.fixture.gameId,
    turn: bobBeforeCombat.turn,
    submittedActionTargets: getActionToSubmintegrationTest(bobBeforeCombat, BuildFleetStandard.id, { planet: input.fixture.bobHome.id }),
  })
  await processPublicTurn({
    clients: input.fixture.clients,
    gameId: input.fixture.gameId,
    turn: aliceBeforeCombat.turn,
    turnProcessor: input.fixture.turnProcessor,
    process: false,
  })
  return { attackJourney, aliceBeforeCombat, bobBeforeCombat, buildAction }
}

export type CreateAttackJourneySetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  aliceDepartureView: PlayerView
  alice: AuthenticatedApiClient
  attackAction: Action
  attackerSource: Fleet
  defender: Fleet
  bob: AuthenticatedApiClient
}

export type CreateAttackJourneySetupResult = {
  attackJourney: Fleet
  aliceBeforeCombat: PlayerView
  bobBeforeCombat: PlayerView
  buildAction: Action
}

export async function createExpectedTargetForcesSetup(
  input: CreateExpectedTargetForcesSetupInput,
): Promise<CreateExpectedTargetForcesSetupResult> {
  const observed = await observeTurnAndRollback({
    ...input,
    turnsRepository: input.fixture.turnsRepository,
    gameId: input.fixture.gameId,
    turn: input.aliceBeforeCombat.turn,
  })
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)

  // Assert: Build reinforces defender20 to30 before the single A30 Assault; both target forces are removed.
  const expectedTargetForces = { [input.playerAId]: [], [input.playerBId]: [] }

  assertOwnerFleetForces({ ...input, forward, expectedTargetForces, permuted })
  const attackContinuations = forward.resolved.resolvedContinuations.filter(
    ({ originatingSubmission }) => originatingSubmission.playerId === input.playerAId && originatingSubmission.id === input.attackAction.id,
  )
  expect(attackContinuations).toHaveLength(1)
  const attackContinuation = attackContinuations[0]
  Assert.isDefined(attackContinuation)
  const assaultResults = attackContinuation.actionOutcomes.filter(
    (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
      outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
  )
  expect(assaultResults).toHaveLength(1)
  expect(assaultResults[0]?.result).toContain("exchanged 30 Strength with 30 enemy Strength")
  const buildActionResult = forward.resolved.resolvedActions.find(
    ({ submittedAction }) => submittedAction.playerId === input.playerBId && submittedAction.id === input.buildAction.id,
  )
  Assert.isDefined(buildActionResult)
  return { expectedTargetForces, buildActionResult }
}

export type CreateExpectedTargetForcesSetupInput = {
  db: Database
  clock: ControlledClock
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  aliceBeforeCombat: PlayerView
  playerAId: PlayerId
  playerBId: PlayerId
  attackJourney: Fleet
  defender: Fleet
  attackAction: Action
  buildAction: Action
}

export type CreateExpectedTargetForcesSetupResult = {
  expectedTargetForces: Record<string, never[]>
  buildActionResult: Readonly<{
    submittedAction: ReturnType<typeof createSubmittedActionStub>
    actionOutcomes: readonly EffectOutcome[]
  }>
}

export async function createFixtureSetup2(input: CreateFixtureSetup2Input): Promise<CreateFixtureSetup2Result> {
  const fixture = await createPublicHomeArrivalFixture({
    ...input,
    ruleset: HomeArrivalMergeRuleset,
    aliceDepartureStrength: 40,
    bobDepartureStrength: 10,
  })
  const alice = fixture.clients[0]
  const playerAId = fixture.playerIds[0]
  const playerBId = fixture.playerIds[1]
  const source = fixture.aliceAtSource
  const defender = fixture.bobAtTarget
  Assert.isDefined(alice)
  Assert.isDefined(playerAId)
  Assert.isDefined(playerBId)
  Assert.isDefined(source)
  Assert.isDefined(defender)
  expect(fixture.aliceAtTarget).toBeUndefined()
  expect([source.strength, defender.strength, fixture.distance]).toStrictEqual([40, 10, 4.418312565270031])

  // Act: reserve20 and15 through two distinct instances of the same pooled Attack Move definition.
  const departureViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  const departureView = departureViews[0]
  Assert.isDefined(departureView)
  return { fixture, alice, playerAId, playerBId, source, defender, departureViews, departureView }
}

export async function createFirstActionSetup(input: CreateFirstActionSetupInput): Promise<CreateFirstActionSetupResult> {
  const beforePayment = input.beforeResourcesByOwner[0]
  Assert.isDefined(beforePayment)
  const firstAction = input.departureView.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_1")
  const secondAction = input.departureView.actions.find(({ id }) => id === "TEST_ATTACK_MOVE_2")
  Assert.isDefined(firstAction)
  Assert.isDefined(secondAction)

  await assertReservedView({ ...input, secondAction, beforePayment })

  // Assert: both captured journeys and the5-force source remainder persist across three intermediate worker reloads.
  let movingView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  const journeyIdByAction = new Map<string, typeof input.source.id>()

  const updatedVerifyJourneyForces = await assertJourneyForces({ ...input, firstAction, secondAction, journeyIdByAction, movingView })
  movingView = updatedVerifyJourneyForces.movingView

  const observed = await observeTurnAndRollback({
    ...input,
    turnsRepository: input.fixture.turnsRepository,
    gameId: input.fixture.gameId,
    turn: movingView.turn,
  })
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)
  expect(ownerFleetForces(forward.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual({
    [input.playerAId]: [25],
    [input.playerBId]: [],
  })
  expect(ownerFleetForces(permuted.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual({
    [input.playerAId]: [25],
    [input.playerBId]: [],
  })
  expect(forward.resolved.removedFleetIds).toContain(input.defender.id)
  const journeyIds = [firstAction.id, secondAction.id].map((actionId) => journeyIdByAction.get(actionId))
  expect(journeyIds.every((journeyId) => journeyId !== undefined)).toBe(true)
  const survivingArrivals = Object.values(forward.resolved.fleets).filter(
    ({ ownerPlayerId, originPlanetId, strength, movement }) =>
      ownerPlayerId === input.playerAId && originPlanetId === input.fixture.aliceHome.id && strength === 25 && movement === undefined,
  )
  expect(survivingArrivals).toHaveLength(1)
  const survivingArrival = survivingArrivals[0]
  return { firstAction, secondAction, observed, forward, permuted, journeyIds, survivingArrival }
}

export type CreateFirstActionSetupInput = {
  beforeResourcesByOwner: Array<{ influence: number; fuel: number }>
  departureView: PlayerView
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  source: Fleet
  defender: Fleet
  playerAId: PlayerId
  playerBId: PlayerId
  db: Database
  clock: ControlledClock
}

export type CreateFirstActionSetupResult = {
  firstAction: Action
  secondAction: Action
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  journeyIds: Array<undefined | FleetId>
  survivingArrival: undefined | ResolutionFleet
}

export function createTieDrawSetup(input: CreateTieDrawSetupInput): CreateTieDrawSetupResult {
  expect(input.journeyIds).toContain(input.survivingArrival.id)
  expect(
    input.journeyIds.filter((journeyId) => journeyId !== undefined && input.forward.resolved.removedFleetIds.includes(journeyId)),
  ).toHaveLength(1)
  const observedContinuations = input.forward.resolved.resolvedContinuations
    .filter(({ originatingSubmission }) => originatingSubmission.playerId === input.playerAId)
    .toSorted((first, second) => compareOrdinalStrings(first.originatingSubmission.id, second.originatingSubmission.id))
  const permutedContinuations = input.permuted.resolved.resolvedContinuations
    .filter(({ originatingSubmission }) => originatingSubmission.playerId === input.playerAId)
    .toSorted((first, second) => compareOrdinalStrings(first.originatingSubmission.id, second.originatingSubmission.id))
  expect(
    observedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
      actionId: originatingSubmission.id,
      outcomes: actionOutcomes,
    })),
  ).toStrictEqual(
    permutedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
      actionId: originatingSubmission.id,
      outcomes: actionOutcomes,
    })),
  )
  const tieDraw = mulberry32FirstDraw(input.observed.rngState.generatorState)
  const canonicalActionIds = [input.firstAction.id, input.secondAction.id].toSorted(compareOrdinalStrings)
  const expectedActionOrder = tieDraw.value < 0.5 ? canonicalActionIds.toReversed() : canonicalActionIds
  expect(observedContinuations).toHaveLength(2)
  const perActionAssaultResults = observedContinuations.map(({ originatingSubmission, actionOutcomes }) => ({
    actionId: originatingSubmission.id,
    results: actionOutcomes.filter(
      (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
        outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
    ),
    noOpResults: actionOutcomes.filter(
      (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
        outcome.type === "RESOLVED" && outcome.result.includes(" found no enemy Fleets "),
    ),
  }))
  const firstAssaultSequence = perActionAssaultResults.find(({ actionId }) => actionId === expectedActionOrder[0])
  const secondAssaultSequence = perActionAssaultResults.find(({ actionId }) => actionId === expectedActionOrder[1])
  Assert.isDefined(firstAssaultSequence)
  Assert.isDefined(secondAssaultSequence)
  expect(firstAssaultSequence.results).toHaveLength(1)
  expect(firstAssaultSequence.results[0]?.result).toContain("exchanged 10 Strength with 10 enemy Strength")
  expect(firstAssaultSequence.noOpResults).toHaveLength(0)
  expect(secondAssaultSequence.results).toHaveLength(0)
  expect(secondAssaultSequence.noOpResults).toHaveLength(1)
  const secondNoOp = secondAssaultSequence.noOpResults[0]
  Assert.isDefined(secondNoOp)
  expect(secondNoOp.result).toContain("found no enemy Fleets")
  return { tieDraw, canonicalActionIds, expectedActionOrder }
}

export type CreateTieDrawSetupInput = {
  journeyIds: Array<undefined | FleetId>
  survivingArrival: ResolutionFleet
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  firstAction: Action
  secondAction: Action
}

export type CreateTieDrawSetupResult = {
  tieDraw: ReturnType<typeof Capturedmulberry32FirstDraw>
  canonicalActionIds: ActionId[]
  expectedActionOrder: ActionId[]
}

export async function createFixtureSetup3(options: CreateFixtureSetup3Input): Promise<CreateFixtureSetup3Result> {
  const { fixture, alice, playerAId, playerBId, source, defender, departureViews, departureView } = await createFixtureSetup2(options)
  return { fixture, alice, playerAId, playerBId, source, enemy: defender, departureViews, departureView }
}

export async function createOrdinaryActionSetup(input: CreateOrdinaryActionSetupInput): Promise<CreateOrdinaryActionSetupResult> {
  const beforeAlicePayment = input.beforeResourcesByOwner[0]
  Assert.isDefined(beforeAlicePayment)
  const ordinaryAction = input.departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
  const attackAction = input.departureView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
  Assert.isDefined(ordinaryAction)
  Assert.isDefined(attackAction)

  await assertReservedView2({ ...input, beforeAlicePayment })

  const firstArrivalObservation = await observeTurnAndRollback({
    ...input,
    turnsRepository: input.fixture.turnsRepository,
    gameId: input.fixture.gameId,
    turn: input.departureView.turn,
  })
  const firstArrivalForward = replayObservedTurn(firstArrivalObservation, false)
  const firstArrivalPermuted = replayObservedTurn(firstArrivalObservation, true)
  const firstArrivalForces = { [input.playerAId]: [20], [input.playerBId]: [10] }
  expect(ownerFleetForces(firstArrivalForward.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    firstArrivalForces,
  )
  expect(ownerFleetForces(firstArrivalPermuted.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    firstArrivalForces,
  )
  expect(normalizedOutcomeSequence(firstArrivalForward.resolved)).toStrictEqual(normalizedOutcomeSequence(firstArrivalPermuted.resolved))
  expect(firstArrivalForward.rngState).toStrictEqual(firstArrivalPermuted.rngState)
  const firstArrivalOutcomes = [
    ...firstArrivalForward.resolved.resolvedActions.flatMap(({ actionOutcomes }) => actionOutcomes),
    ...firstArrivalForward.resolved.resolvedContinuations.flatMap(({ actionOutcomes }) => actionOutcomes),
  ]
  expect(
    firstArrivalOutcomes.filter(
      (outcome) =>
        outcome.type === "RESOLVED" && (outcome.result.includes(" exchanged ") || outcome.result.includes(" found no enemy Fleets ")),
    ),
  ).toHaveLength(0)
  expect(
    Object.values(firstArrivalForward.resolved.fleets).find(isOrdinaryArrival(input.playerAId, input.fixture.aliceHome.id)),
  ).toBeDefined()

  expect(await input.fixture.turnProcessor.processNextDueTurn()).toBe("processed")
  const movingView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  const ordinaryArrival = movingView.fleets.find(isOrdinaryArrival(input.playerAId, input.fixture.aliceHome.id))
  const attackJourney = movingView.fleets.find(({ movement }) => movement?.submission.id === attackAction.id)
  Assert.isDefined(ordinaryArrival)
  Assert.isDefined(attackJourney)
  const attackJourneyId = attackJourney.id
  return { ordinaryAction, attackAction, firstArrivalForces, movingView, ordinaryArrival, attackJourney, attackJourneyId }
}

export type CreateOrdinaryActionSetupInput = {
  beforeResourcesByOwner: Array<{ influence: number; fuel: number }>
  departureView: PlayerView
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  source: Fleet
  db: Database
  clock: ControlledClock
  playerAId: PlayerId
  playerBId: PlayerId
}

export type CreateOrdinaryActionSetupResult = {
  ordinaryAction: Action
  attackAction: Action
  firstArrivalForces: Record<string, number[]>
  movingView: PlayerView
  ordinaryArrival: Fleet
  attackJourney: Fleet
  attackJourneyId: FleetId
}

function isOrdinaryArrival(
  playerId: PlayerId,
  homeId: Fleet["originPlanetId"],
): (fleet: Pick<Fleet, "ownerPlayerId" | "originPlanetId" | "strength"> & { movement?: unknown }) => boolean {
  return ({ ownerPlayerId, originPlanetId, strength, movement }) =>
    ownerPlayerId === playerId && originPlanetId === homeId && strength === 20 && movement === undefined
}
