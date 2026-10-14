import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { EffectOutcome } from "shared/domain/turns/actions/EffectOutcome.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { expect } from "vitest"
import type { Fleet, Action, Planet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { replayObservedTurn as CapturedreplayObservedTurn } from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type { createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture } from "#tests/fleet-worker/TurnProcessor.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  normalizedOutcomeSequence,
  ownerFleetForces,
  ownerPublicForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../fleet-worker/TurnProcessor.scenarios.ts"

export function assertOwnerFleetForces({
  forward,
  fixture,
  expectedTargetForces,
  permuted,
  playerAId,
  playerBId,
  attackJourney,
  defender,
}: AssertOwnerFleetForcesInput): void {
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
  expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
    [playerAId]: [10],
    [playerBId]: [20],
  })
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(permuted.rngState)
  expect(
    Object.values(forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  ).toStrictEqual(
    Object.values(permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  )
  expect(forward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([attackJourney.id, defender.id]))
}

export type AssertOwnerFleetForcesInput = {
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  expectedTargetForces: Record<string, never[]>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  playerBId: PlayerId
  attackJourney: Fleet
  defender: Fleet
}

export async function assertBuildActionResult({
  buildActionResult,
  defender,
  fixture,
  aliceBeforeDeparture,
  bobBeforeCombat,
  expectedTargetForces,
  playerAId,
  attackAction,
  buildAction,
  attackerSource,
}: AssertBuildActionResultInput): Promise<void> {
  expect(buildActionResult.actionOutcomes).toHaveLength(3)
  expect(buildActionResult.actionOutcomes).toStrictEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("spent 2 INFLUENCE") }),
      expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("spent 1 METAL") }),
      expect.objectContaining({
        type: "RESOLVED",
        result: expect.stringContaining(`reinforced Fleet "${defender.id}" by 10`),
      }),
    ]),
  )

  // Assert: the actual worker removes both target forces, preserves source10, releases the actions, and charges each owner correctly.
  expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterCombatViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  const beforeResourcesByOwner = [
    {
      influence: aliceBeforeDeparture.influence,
      fuel: aliceBeforeDeparture.fuel,
      metal: aliceBeforeDeparture.metal,
    },
    {
      influence: bobBeforeCombat.resources[ResourceType.INFLUENCE].total,
      fuel: bobBeforeCombat.resources[ResourceType.FUEL].total,
      metal: bobBeforeCombat.resources[ResourceType.METAL].total,
    },
  ]
  for (let ownerIndex = 0; ownerIndex < afterCombatViews.length; ownerIndex += 1) {
    const view = afterCombatViews[ownerIndex]
    const before = beforeResourcesByOwner[ownerIndex]
    const ownerPlayerId = fixture.playerIds[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(before)
    Assert.isDefined(ownerPlayerId)
    expect(ownerPublicForces(view.fleets, fixture.playerIds, fixture.bobHome.id)).toStrictEqual(expectedTargetForces)
    if (ownerPlayerId === playerAId) {
      expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.influence - 5)
      expect(view.resources[ResourceType.FUEL].total).toBe(before.fuel - 1)
      expect(view.resources[ResourceType.METAL].total).toBe(before.metal)
    } else {
      expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.influence - 2)
      expect(view.resources[ResourceType.METAL].total).toBe(before.metal - 1)
      expect(view.resources[ResourceType.FUEL].total).toBe(before.fuel)
    }
    expect(view.actions.find(({ id }) => id === (ownerPlayerId === playerAId ? attackAction.id : buildAction.id))).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
  }
  expect(afterCombatViews[0]?.fleets.find(({ id }) => id === attackerSource.id)?.strength).toBe(10)
}

export type AssertBuildActionResultInput = {
  buildActionResult: Readonly<{ submittedAction: ReturnType<typeof createSubmittedActionStub>; actionOutcomes: readonly EffectOutcome[] }>
  defender: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  aliceBeforeDeparture: { influence: number; fuel: number; metal: number }
  bobBeforeCombat: PlayerView
  expectedTargetForces: Record<string, never[]>
  playerAId: PlayerId
  attackAction: Action
  buildAction: Action
  attackerSource: Fleet
}

export async function assertReservedView({
  alice,
  fixture,
  departureView,
  source,
  secondAction,
  beforePayment,
}: AssertReservedViewInput): Promise<void> {
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      departureView,
      AttackMoveTest.id,
      { fleet: source.id, planet: fixture.aliceHome.id },
      { strength: 20 },
    ),
  })
  const secondSubmission = getActionToSubmintegrationTest(
    departureView,
    AttackMoveTest.id,
    { fleet: source.id, planet: fixture.aliceHome.id },
    { strength: 15 },
  )
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: { ...secondSubmission, actionId: secondAction.id },
  })
  const reservedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  expect(reservedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(beforePayment.influence - 10)
  expect(reservedView.resources[ResourceType.FUEL].uncommitted).toBe(beforePayment.fuel - 2)
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: departureView.turn,
    turnProcessor: fixture.turnProcessor,
  })
}

export type AssertReservedViewInput = {
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  departureView: PlayerView
  source: Fleet
  secondAction: Action
  beforePayment: { influence: number; fuel: number }
}

export type AssertReservedView2Input = {
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  departureView: PlayerView
  source: Fleet
  beforeAlicePayment: { influence: number; fuel: number }
}

export async function assertJourneyForces({
  firstAction,
  secondAction,
  journeyIdByAction,
  movingView,
  source,
  fixture,
  alice,
  defender,
  playerAId,
  playerBId,
}: AssertJourneyForcesInput): Promise<AssertJourneyForcesResult> {
  const journeyForces = (
    view: PlayerView,
  ): Array<{
    id: PlayerView["fleets"][number]["id"]
    strength: number
    distanceToEnd: PlayerView["fleets"][number]["distanceToEnd"] | undefined
  }> =>
    [firstAction, secondAction].map((action) => {
      const journey = view.fleets.find(({ movement }) => movement?.submission.id === action.id)
      Assert.isDefined(journey)
      journeyIdByAction.set(action.id, journey.id)
      return { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd }
    })
  expect(journeyForces(movingView).map(({ strength, distanceToEnd }) => [strength, distanceToEnd])).toStrictEqual([
    [20, 3.418312565270031],
    [15, 3.418312565270031],
  ])
  expect(movingView.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
  for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: movingView.turn,
      turnProcessor: fixture.turnProcessor,
    })
    movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    expect(journeyForces(movingView).map(({ distanceToEnd }) => distanceToEnd)).toStrictEqual([remainingDistance, remainingDistance])
    expect(movingView.fleets.find(({ id }) => id === defender.id)?.strength).toBe(10)
    expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual({
      [playerAId]: [],
      [playerBId]: [10],
    })
  }

  // Act: observe the natural production-loaded arrival turn in a transaction that rolls back, then replay independent permutations.
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: movingView.turn,
    turnProcessor: fixture.turnProcessor,
    process: false,
  })

  return { movingView }
}

export type AssertJourneyForcesInput = {
  firstAction: Action
  secondAction: Action
  journeyIdByAction: Map<string, FleetId>
  movingView: PlayerView
  source: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  alice: AuthenticatedApiClient
  defender: Fleet
  playerAId: PlayerId
  playerBId: PlayerId
}

export type AssertJourneyForcesResult = { movingView: PlayerView }

export async function assertEmptyObserved({
  fixture,
  emptyTurn,
  db,
  clock,
  forward,
  assertEmptyObservedPhase4Observed,
  assertEmptyObservedPhase4Value1,
  canonicalActionIds,
  expectedActionOrder,
  afterArrivalViews,
}: AssertEmptyObservedInput): Promise<void> {
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: emptyTurn.turn,
    turnProcessor: fixture.turnProcessor,
    process: false,
  })
  const emptyObserved = await observeTurnAndRollback({
    db,
    clock,
    turnsRepository: fixture.turnsRepository,
    gameId: fixture.gameId,
    turn: emptyTurn.turn,
  })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(forward.rngState)
  logWorkerObservation(
    "[I2-09 natural two-Assault worker observation]",
    JSON.stringify({
      generatorState: assertEmptyObservedPhase4Observed.rngState.generatorState,
      tieDraw: assertEmptyObservedPhase4Value1,
      canonicalActionIds,
      selectedActionOrder: expectedActionOrder,
      replayNextState: forward.rngState,
      workerNextState: emptyObserved.rngState,
    }),
  )
  expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
  const afterEmptyViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  expect(
    afterEmptyViews[0]?.fleets
      .map(({ id, ownerPlayerId, originPlanetId, strength }) => ({ id, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  ).toStrictEqual(
    afterArrivalViews[0]?.fleets
      .map(({ id, ownerPlayerId, originPlanetId, strength }) => ({ id, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  )
}

export type AssertEmptyObservedInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  emptyTurn: PlayerView
  db: Database
  clock: ControlledClock
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  assertEmptyObservedPhase4Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  assertEmptyObservedPhase4Value1: number
  canonicalActionIds: ActionId[]
  expectedActionOrder: ActionId[]
  afterArrivalViews: PlayerView[]
}

export async function assertReservedView2({
  alice,
  fixture,
  departureView,
  source,
  beforeAlicePayment,
}: AssertReservedView2Input): Promise<void> {
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      departureView,
      MoveFleetExceptional.id,
      { fleet: source.id, planet: fixture.aliceHome.id },
      { strength: 20 },
    ),
  })
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      departureView,
      AttackMoveTest.id,
      { fleet: source.id, planet: fixture.aliceHome.id },
      { strength: 15 },
    ),
  })
  const reservedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  expect(reservedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(beforeAlicePayment.influence - 8)
  expect(reservedView.resources[ResourceType.FUEL].uncommitted).toBe(beforeAlicePayment.fuel - 6)

  // Assert: on the first real arrival turn the ordinary fleet is stationed, while Attack15 is still in transit and no Assault ran.
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: departureView.turn,
    turnProcessor: fixture.turnProcessor,
    process: false,
  })
}

export async function assertOwnerPublicForces({
  movingView,
  fixture,
  firstArrivalForces,
  attackJourney,
  source,
  ordinaryAction,
  attackAction,
  beforeResourcesByOwner,
  playerAId,
  alice,
  ordinaryArrival,
  enemy,
  attackJourneyId,
}: AssertOwnerPublicForcesInput): Promise<AssertOwnerPublicForcesResult> {
  expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
  expect([attackJourney.strength, attackJourney.distanceToEnd, attackJourney.movement?.speed]).toStrictEqual([15, 3.418312565270031, 1])
  expect(movingView.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
  expect(movingView.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(movingView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ isInProgress: true })
  for (let ownerIndex = 0; ownerIndex < fixture.clients.length; ownerIndex += 1) {
    const ownerView = await fixture.clients[ownerIndex]?.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    const baseline = beforeResourcesByOwner[ownerIndex]
    Assert.isDefined(ownerView)
    Assert.isDefined(baseline)
    expect(ownerView.resources[ResourceType.INFLUENCE].total).toBe(
      baseline.influence - (fixture.playerIds[ownerIndex] === playerAId ? 8 : 0),
    )
    expect(ownerView.resources[ResourceType.FUEL].total).toBe(baseline.fuel - (fixture.playerIds[ownerIndex] === playerAId ? 6 : 0))
  }

  // Assert: the already-stationed ordinary20 coexists with enemy10 through each later travel turn.
  for (const remainingDistance of [2.418312565270031, 1.418312565270031, 0.418312565270031]) {
    await processPublicTurn({
      clients: fixture.clients,
      gameId: fixture.gameId,
      turn: movingView.turn,
      turnProcessor: fixture.turnProcessor,
    })
    movingView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
    const stationaryOrdinaryArrival = movingView.fleets.find(({ id }) => id === ordinaryArrival.id)
    expect(stationaryOrdinaryArrival).toMatchObject({ id: ordinaryArrival.id, name: ordinaryArrival.name, strength: 20 })
    expect(stationaryOrdinaryArrival?.movement).toBeUndefined()
    expect(movingView.fleets.find(({ id }) => id === enemy.id)).toMatchObject({ id: enemy.id, strength: 10 })
    expect(ownerPublicForces(movingView.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(firstArrivalForces)
    const inTransitAttack = movingView.fleets.find(({ id }) => id === attackJourneyId)
    Assert.isDefined(inTransitAttack)
    expect(inTransitAttack.distanceToEnd).toBe(remainingDistance)
  }

  // Act: capture the later Attack15 arrival, then compare a replay with permuted public submission order.
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: movingView.turn,
    turnProcessor: fixture.turnProcessor,
    process: false,
  })

  return { movingView }
}

export type AssertOwnerPublicForcesInput = {
  movingView: PlayerView
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  firstArrivalForces: Record<string, number[]>
  attackJourney: Fleet
  source: Fleet
  ordinaryAction: Action
  attackAction: Action
  beforeResourcesByOwner: Array<{ influence: number; fuel: number }>
  playerAId: PlayerId
  alice: AuthenticatedApiClient
  ordinaryArrival: Fleet
  enemy: Fleet
  attackJourneyId: FleetId
}

export type AssertOwnerPublicForcesResult = { movingView: PlayerView }

export async function assertAssaultResults({
  attackContinuation,
  fixture,
  beforeResourcesByOwner,
  finalTargetForces,
  ordinaryArrival,
  attackJourneyId,
  enemy,
  playerAId,
  ordinaryAction,
  attackAction,
  source,
}: AssertAssaultResultsInput): Promise<void> {
  const assaultResults = attackContinuation.actionOutcomes.filter(
    (outcome): outcome is Extract<EffectOutcome, { type: "RESOLVED" }> =>
      outcome.type === "RESOLVED" && outcome.result.includes(" exchanged "),
  )
  expect(assaultResults).toHaveLength(1)
  expect(assaultResults[0]?.result).toContain("exchanged 10 Strength with 10 enemy Strength")

  // Assert: the worker persists the old ordinary fleet identity at25, removes the arriving child/enemy, and releases both orders.
  expect(await fixture.turnProcessor.processNextDueTurn()).toBe("processed")
  const arrivalViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )
  for (let ownerIndex = 0; ownerIndex < arrivalViews.length; ownerIndex += 1) {
    const view = arrivalViews[ownerIndex]
    const baseline = beforeResourcesByOwner[ownerIndex]
    const ownerPlayerId = fixture.playerIds[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(baseline)
    Assert.isDefined(ownerPlayerId)
    expect(ownerPublicForces(view.fleets, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(finalTargetForces)
    const savedOrdinaryArrival = view.fleets.find(({ id }) => id === ordinaryArrival.id)
    expect(savedOrdinaryArrival).toMatchObject({ id: ordinaryArrival.id, name: ordinaryArrival.name, strength: 25 })
    expect(savedOrdinaryArrival?.movement).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === attackJourneyId)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
    expect(view.resources[ResourceType.INFLUENCE].total).toBe(baseline.influence - (ownerPlayerId === playerAId ? 8 : 0))
    expect(view.resources[ResourceType.FUEL].total).toBe(baseline.fuel - (ownerPlayerId === playerAId ? 6 : 0))
    expect(view.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  }
  expect(arrivalViews[0]?.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 5 })
}

export type AssertAssaultResultsInput = {
  attackContinuation: ResolvedTurnState["resolvedContinuations"][number]
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  beforeResourcesByOwner: Array<{ influence: number; fuel: number }>
  finalTargetForces: Record<string, number[]>
  ordinaryArrival: Fleet
  attackJourneyId: FleetId
  enemy: Fleet
  playerAId: PlayerId
  ordinaryAction: Action
  attackAction: Action
  source: Fleet
}

export async function assertTarget({ target, bobHome, clients, gameId, turnProcessor }: AssertTargetInput): Promise<void> {
  expect(target).toMatchObject({
    id: "57c1b320-c267-5c9b-a5a5-1b5a02823714",
    name: "planet 552840",
    coordinates: "45:83:40",
    x: 53.24122006799319,
    y: 48.68601626316641,
  })
  expect(bobHome).toMatchObject({
    id: "ec56a9af-3995-521c-822d-84685a96fdc6",
    name: "planet 819299",
    coordinates: "44:98:05",
    x: 48.987456457561635,
    y: 49.880579392930315,
  })

  for (let buildRound = 0; buildRound < 4; buildRound += 1) {
    const views = await Promise.all(clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId })))
    for (const [ownerIndex, client] of clients.entries()) {
      const view = views[ownerIndex]
      const home = ownerIndex === 0 ? target : bobHome
      Assert.isDefined(view)
      if (buildRound < (ownerIndex === 0 ? 4 : 2)) {
        await client.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: view.turn,
          submittedActionTargets: getActionToSubmintegrationTest(view, BuildFleetStandard.id, { planet: home.id }),
        })
      }
    }
    const view = views[0]
    Assert.isDefined(view)
    await processPublicTurn({ clients, gameId, turn: view.turn, turnProcessor })
  }
}

export type AssertTargetInput = {
  target: Planet
  bobHome: Planet
  clients: AuthenticatedApiClient[]
  gameId: GameId
  turnProcessor: TurnProcessor
}
