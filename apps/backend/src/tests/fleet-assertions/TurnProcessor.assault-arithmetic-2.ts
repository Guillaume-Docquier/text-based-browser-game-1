import { Assert } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetImproved } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { v5 } from "uuid"
import { expect } from "vitest"
import type { Planet, Fleet, Action, PlayerView } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { replayObservedTurn as CapturedreplayObservedTurn } from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import type {
  createPublicAssaultStagingFixture as CapturedcreatePublicAssaultStagingFixture,
  createPublicHomeArrivalFixture as CapturedcreatePublicHomeArrivalFixture,
} from "#tests/fleet-worker/TurnProcessor.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  normalizedOutcomeSequence,
  outcomeForOwner,
  ownerFleetForces,
  getActionToSubmintegrationTest,
  logWorkerObservation,
} from "../fleet-worker/TurnProcessor.scenarios.ts"
import type { AssertIndex2Input, AssertEmptyObserved2Input } from "./TurnProcessor.assault-arithmetic.ts"

export async function assertIndex2({ fixture, beforeViews, definitions, forces, actionIds, target }: AssertIndex2Input): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    const client = fixture.clients[index]
    const view = beforeViews[index]
    const fleet = fixture.stationed[index]
    const definition = definitions[index]
    const force = forces[index]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    Assert.isDefined(definition)
    Assert.isDefined(force)
    const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === definition.id)
    Assert.isDefined(action)
    actionIds.push(action.id)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: fixture.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        definition.id,
        { fleet: fleet.id, planet: target.id },
        { strength: force },
      ),
    })
  }
}

export function assertSurvivor({
  survivor,
  secondJourneyId,
  fleetB,
  fixture,
  target,
  afterViews,
  fleetC,
  thirdJourneyId,
  beforeViews,
  actionIds,
}: AssertSurvivorInput): void {
  assertSurvivor2({ survivor, secondJourneyId, fleetB, fixture, target, afterViews, fleetC, thirdJourneyId })
  for (let index = 0; index < 3; index += 1) {
    const before = beforeViews[index]
    const after = afterViews[index]
    const actionId = actionIds[index]
    Assert.isDefined(before)
    Assert.isDefined(after)
    Assert.isDefined(actionId)
    expect(after.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(after.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - 5)
    expect(after.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total - 1)
  }
}

export type AssertSurvivorInput = {
  survivor: ResolutionFleet
  secondJourneyId: string
  fleetB: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  target: Planet
  afterViews: PlayerView[]
  fleetC: Fleet
  thirdJourneyId: string
  beforeViews: PlayerView[]
  actionIds: string[]
}

export type AssertSurvivor2Input = {
  survivor: ResolutionFleet
  secondJourneyId: string
  fleetB: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  target: Planet
  afterViews: PlayerView[]
  fleetC: Fleet
  thirdJourneyId: string
}

export function assertSurvivor2({
  survivor,
  secondJourneyId,
  fleetB,
  fixture,
  target,
  afterViews,
  fleetC,
  thirdJourneyId,
}: AssertSurvivor2Input): void {
  expect(survivor).toMatchObject({
    id: secondJourneyId,
    name: fleetB.name,
    ownerPlayerId: fixture.playerIds[1],
    strength: 8,
    originPlanetId: target.id,
  })
  expect(afterViews[0]?.fleets.find(({ id }) => id === fleetB.id)).toBeUndefined()
  expect(afterViews[0]?.fleets.find(({ id }) => id === survivor.id)).toMatchObject({
    id: secondJourneyId,
    name: fleetB.name,
    ownerPlayerId: fixture.playerIds[1],
    strength: 8,
    originPlanetId: target.id,
  })
  expect(afterViews[0]?.fleets.find(({ id }) => id === fleetC.id)).toBeUndefined()
  expect(afterViews[0]?.fleets.find(({ id }) => id === thirdJourneyId)).toBeUndefined()
}

export async function assertEmptyObserved2({
  fixture,
  emptyTurn,
  db,
  clock,
  turnsRepository,
  assertEmptyObservedPhase6Observed,
  turnProcessor,
}: AssertEmptyObserved2Input): Promise<void> {
  await Promise.all(
    fixture.clients.map(
      async ({ client }) =>
        await client.gameplay.updateReadiness.mutate({
          gameId: fixture.gameId,
          turn: emptyTurn.turn,
          isReady: true,
        }),
    ),
  )
  const emptyObserved = await observeTurnAndRollback({ db, clock, turnsRepository, gameId: fixture.gameId, turn: emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(assertEmptyObservedPhase6Observed.rngState)
  logWorkerObservation(
    "[I2-05 public worker]",
    JSON.stringify({
      generatorState: assertEmptyObservedPhase6Observed.rngState.generatorState,
      draws: [],
      ticks: [5, 10, 15],
      outcomes: [10, 16, "Prevented"],
      nextState: emptyObserved.rngState,
    }),
  )
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertOutcomeForOwner({
  forward,
  playerAId,
  assaultAction,
  attacker,
  fixture,
  permuted,
  playerBId,
  assertAssertOutcomeForOwnerState1Phase7Observed,
  turnProcessor,
  moveView,
  moveAction,
  enemy,
  enemyHome,
}: AssertOutcomeForOwnerInput): Promise<void> {
  await assertOutcomeForOwner2({
    forward,
    playerAId,
    assaultAction,
    attacker,
    fixture,
    permuted,
    playerBId,
    assertAssertOutcomeForOwnerState1Phase7Observed,
    turnProcessor,
  })
  const afterViews = await Promise.all(
    fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: fixture.gameId })),
  )

  // Assert: the attacker remains30 and the departing enemy retains20 from this origin at literal remainder4.318.
  expect(afterViews[0]?.fleets.find(({ id }) => id === attacker.id)).toMatchObject({
    id: attacker.id,
    strength: 30,
    originPlanetId: fixture.stagingPlanet.id,
  })
  const expectedEnemyDepartureId = v5(
    JSON.stringify([fixture.gameId, playerBId, moveView.turn, moveAction.id, enemy.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  expect(afterViews[0]?.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
  expect(afterViews[0]?.fleets.find(({ id }) => id === expectedEnemyDepartureId)).toMatchObject({
    id: expectedEnemyDepartureId,
    name: enemy.name,
    strength: 20,
    originPlanetId: fixture.stagingPlanet.id,
    destinationPlanetId: enemyHome.id,
    distanceToEnd: 4.318312565270031,
    movement: { speed: 0.1 },
  })
  expect(afterViews[0]?.actions.find(({ id }) => id === assaultAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  expect(afterViews[1]?.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
}

export type AssertOutcomeForOwnerInput = {
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  assaultAction: Action
  attacker: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  playerBId: PlayerId
  assertAssertOutcomeForOwnerState1Phase7Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  moveView: PlayerView
  moveAction: Action
  enemy: Fleet
  enemyHome: Planet
}

export type AssertOutcomeForOwner2Input = {
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  assaultAction: Action
  attacker: Fleet
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicAssaultStagingFixture>>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  playerBId: PlayerId
  assertAssertOutcomeForOwnerState1Phase7Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
}

export async function assertOutcomeForOwner2({
  forward,
  playerAId,
  assaultAction,
  attacker,
  fixture,
  permuted,
  playerBId,
  assertAssertOutcomeForOwnerState1Phase7Observed,
  turnProcessor,
}: AssertOutcomeForOwner2Input): Promise<void> {
  expect(outcomeForOwner(forward.resolved, playerAId, assaultAction.id)).toStrictEqual({
    type: "RESOLVED",
    result: 'Fleet "' + attacker.name + '" found no enemy Fleets at Planet "' + fixture.stagingPlanet.name + '"',
  })
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(
    Object.fromEntries(
      fixture.playerIds.map((playerId) => [
        playerId,
        Object.values(forward.resolved.fleets)
          .filter(
            ({ ownerPlayerId, originPlanetId, movement }) =>
              ownerPlayerId === playerId && originPlanetId === fixture.stagingPlanet.id && movement === undefined,
          )
          .map(({ strength }) => strength),
      ]),
    ),
  ).toStrictEqual({
    [playerAId]: [30],
    [playerBId]: [],
  })
  expect(forward.rngState).toStrictEqual(assertAssertOutcomeForOwnerState1Phase7Observed.rngState)
  expect(permuted.rngState).toStrictEqual(assertAssertOutcomeForOwnerState1Phase7Observed.rngState)

  // Act: the actual worker reloads, applies the departure/no-op, and saves both public rows.
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertSelectedView({ alice, fixture, departureView, attackerSource }: AssertSelectedViewInput): Promise<void> {
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      departureView,
      AttackMoveTest.id,
      { fleet: attackerSource.id, planet: fixture.aliceHome.id },
      { strength: 20 },
    ),
  })
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: fixture.gameId,
    turn: departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      departureView,
      MoveFleetImproved.id,
      { fleet: attackerSource.id, planet: fixture.aliceHome.id },
      { strength: 5 },
    ),
  })
  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId: fixture.gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total - 8)
  expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total - 4)
  await processPublicTurn({
    clients: fixture.clients,
    gameId: fixture.gameId,
    turn: departureView.turn,
    turnProcessor: fixture.turnProcessor,
  })
}

export type AssertSelectedViewInput = {
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  departureView: PlayerView
  attackerSource: Fleet
}

export function assertPermuted({
  assertPermutedPhase9Observed,
  playerAId,
  playerBId,
  forward,
  fixture,
  attackJourney,
  ordinaryJourney,
  enemy,
}: AssertPermutedInput): void {
  const permuted = replayObservedTurn(assertPermutedPhase9Observed, true)
  const expectedTargetForces = { [playerAId]: [22], [playerBId]: [] }

  assertOwnerFleetForces({ forward, fixture, expectedTargetForces, permuted, playerAId, playerBId, attackJourney, ordinaryJourney, enemy })
}

export type AssertPermutedInput = {
  assertPermutedPhase9Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  playerAId: PlayerId
  playerBId: PlayerId
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  attackJourney: Fleet
  ordinaryJourney: Fleet
  enemy: Fleet
}

export function assertOwnerFleetForces({
  forward,
  fixture,
  expectedTargetForces,
  permuted,
  playerAId,
  playerBId,
  attackJourney,
  ordinaryJourney,
  enemy,
}: AssertOwnerFleetForcesInput): void {
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(expectedTargetForces)
  expect(ownerFleetForces(permuted.resolved, fixture.playerIds, fixture.aliceHome.id)).toStrictEqual(expectedTargetForces)
  expect(ownerFleetForces(forward.resolved, fixture.playerIds, fixture.bobHome.id)).toStrictEqual({
    [playerAId]: [8],
    [playerBId]: [],
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
  expect(forward.resolved.removedFleetIds).toStrictEqual(expect.arrayContaining([attackJourney.id, ordinaryJourney.id, enemy.id]))
}

export type AssertOwnerFleetForcesInput = {
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  expectedTargetForces: Record<string, number[]>
  permuted: ReturnType<typeof CapturedreplayObservedTurn>
  playerAId: PlayerId
  playerBId: PlayerId
  attackJourney: Fleet
  ordinaryJourney: Fleet
  enemy: Fleet
}

export function assertOwnerIndex({
  afterCombat,
  beforeCombatViews,
  fixture,
  initialFriendly,
  playerAId,
  enemy,
  attackJourney,
  ordinaryJourney,
  attackerSource,
  attackAction,
  ordinaryAction,
  buildAction,
}: AssertOwnerIndexInput): void {
  for (let ownerIndex = 0; ownerIndex < afterCombat.length; ownerIndex += 1) {
    const view = afterCombat[ownerIndex]
    const before = beforeCombatViews[ownerIndex]
    const ownerPlayerId = fixture.playerIds[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(before)
    Assert.isDefined(ownerPlayerId)
    expect(view.fleets.find(({ id }) => id === initialFriendly.id)).toMatchObject({
      id: initialFriendly.id,
      name: initialFriendly.name,
      ownerPlayerId: playerAId,
      originPlanetId: fixture.aliceHome.id,
      strength: 22,
    })
    expect(view.fleets.find(({ id }) => id === enemy.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === attackJourney.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === ordinaryJourney.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === attackerSource.id)).toMatchObject({ id: attackerSource.id, strength: 8 })
    expect(view.actions.find(({ id }) => id === attackAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === buildAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const aliceBuildInfluenceCost = ownerPlayerId === playerAId ? 2 : 0
    const aliceBuildMetalCost = ownerPlayerId === playerAId ? 1 : 0
    expect(view.resources[ResourceType.INFLUENCE].total).toBe(before.resources[ResourceType.INFLUENCE].total - aliceBuildInfluenceCost)
    expect(view.resources[ResourceType.METAL].total).toBe(before.resources[ResourceType.METAL].total - aliceBuildMetalCost)
    expect(view.resources[ResourceType.FUEL].total).toBe(before.resources[ResourceType.FUEL].total)
  }
}

export type AssertOwnerIndexInput = {
  afterCombat: PlayerView[]
  beforeCombatViews: PlayerView[]
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  initialFriendly: Fleet
  playerAId: PlayerId
  enemy: Fleet
  attackJourney: Fleet
  ordinaryJourney: Fleet
  attackerSource: Fleet
  attackAction: Action
  ordinaryAction: Action
  buildAction: Action
}
