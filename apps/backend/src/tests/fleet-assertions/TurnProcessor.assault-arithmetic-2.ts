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

export async function assertIndex2(input: AssertIndex2Input): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    const client = input.fixture.clients[index]
    const view = input.beforeViews[index]
    const fleet = input.fixture.stationed[index]
    const definition = input.definitions[index]
    const force = input.forces[index]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(fleet)
    Assert.isDefined(definition)
    Assert.isDefined(force)
    const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === definition.id)
    Assert.isDefined(action)
    input.actionIds.push(action.id)
    await client.client.gameplay.updateActionSubmission.mutate({
      gameId: input.fixture.gameId,
      turn: view.turn,
      submittedActionTargets: getActionToSubmintegrationTest(
        view,
        definition.id,
        { fleet: fleet.id, planet: input.target.id },
        { strength: force },
      ),
    })
  }
}

export function assertSurvivor(input: AssertSurvivorInput): void {
  assertSurvivor2({ ...input })
  for (let index = 0; index < 3; index += 1) {
    const before = input.beforeViews[index]
    const after = input.afterViews[index]
    const actionId = input.actionIds[index]
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

export function assertSurvivor2(input: AssertSurvivor2Input): void {
  expect(input.survivor).toMatchObject({
    id: input.secondJourneyId,
    name: input.fleetB.name,
    ownerPlayerId: input.fixture.playerIds[1],
    strength: 8,
    originPlanetId: input.target.id,
  })
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.fleetB.id)).toBeUndefined()
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.survivor.id)).toMatchObject({
    id: input.secondJourneyId,
    name: input.fleetB.name,
    ownerPlayerId: input.fixture.playerIds[1],
    strength: 8,
    originPlanetId: input.target.id,
  })
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.fleetC.id)).toBeUndefined()
  expect(input.afterViews[0]?.fleets.find(({ id }) => id === input.thirdJourneyId)).toBeUndefined()
}

export async function assertEmptyObserved2(input: AssertEmptyObserved2Input): Promise<void> {
  await Promise.all(
    input.fixture.clients.map(
      async ({ client }) =>
        await client.gameplay.updateReadiness.mutate({
          gameId: input.fixture.gameId,
          turn: input.emptyTurn.turn,
          isReady: true,
        }),
    ),
  )
  const emptyObserved = await observeTurnAndRollback({ ...input, gameId: input.fixture.gameId, turn: input.emptyTurn.turn })
  expect(emptyObserved.submittedActions).toStrictEqual([])
  expect(emptyObserved.rngState).toStrictEqual(input.assertEmptyObservedPhase6Observed.rngState)
  logWorkerObservation(
    "[I2-05 public worker]",
    JSON.stringify({
      generatorState: input.assertEmptyObservedPhase6Observed.rngState.generatorState,
      draws: [],
      ticks: [5, 10, 15],
      outcomes: [10, 16, "Prevented"],
      nextState: emptyObserved.rngState,
    }),
  )
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertOutcomeForOwner(input: AssertOutcomeForOwnerInput): Promise<void> {
  await assertOutcomeForOwner2({ ...input })
  const afterViews = await Promise.all(
    input.fixture.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })),
  )

  // Assert: the attacker remains30 and the departing enemy retains20 from this origin at literal remainder4.318.
  expect(afterViews[0]?.fleets.find(({ id }) => id === input.attacker.id)).toMatchObject({
    id: input.attacker.id,
    strength: 30,
    originPlanetId: input.fixture.stagingPlanet.id,
  })
  const expectedEnemyDepartureId = v5(
    JSON.stringify([input.fixture.gameId, input.playerBId, input.moveView.turn, input.moveAction.id, input.enemy.id]),
    "3ac0b19b-e901-4bbf-a1dd-4ed71f73c136",
  )
  expect(afterViews[0]?.fleets.find(({ id }) => id === input.enemy.id)).toBeUndefined()
  expect(afterViews[0]?.fleets.find(({ id }) => id === expectedEnemyDepartureId)).toMatchObject({
    id: expectedEnemyDepartureId,
    name: input.enemy.name,
    strength: 20,
    originPlanetId: input.fixture.stagingPlanet.id,
    destinationPlanetId: input.enemyHome.id,
    distanceToEnd: 4.318312565270031,
    movement: { speed: 0.1 },
  })
  expect(afterViews[0]?.actions.find(({ id }) => id === input.assaultAction.id)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(afterViews[1]?.actions.find(({ id }) => id === input.moveAction.id)?.isInProgress).toBe(true)
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

export async function assertOutcomeForOwner2(input: AssertOutcomeForOwner2Input): Promise<void> {
  expect(outcomeForOwner(input.forward.resolved, input.playerAId, input.assaultAction.id)).toStrictEqual({
    type: "RESOLVED",
    result: 'Fleet "' + input.attacker.name + '" found no enemy Fleets at Planet "' + input.fixture.stagingPlanet.name + '"',
  })
  expect(normalizedOutcomeSequence(input.forward.resolved)).toStrictEqual(normalizedOutcomeSequence(input.permuted.resolved))
  expect(
    Object.fromEntries(
      input.fixture.playerIds.map((playerId) => [
        playerId,
        Object.values(input.forward.resolved.fleets)
          .filter(
            ({ ownerPlayerId, originPlanetId, movement }) =>
              ownerPlayerId === playerId && originPlanetId === input.fixture.stagingPlanet.id && movement === undefined,
          )
          .map(({ strength }) => strength),
      ]),
    ),
  ).toStrictEqual({
    [input.playerAId]: [30],
    [input.playerBId]: [],
  })
  expect(input.forward.rngState).toStrictEqual(input.assertAssertOutcomeForOwnerState1Phase7Observed.rngState)
  expect(input.permuted.rngState).toStrictEqual(input.assertAssertOutcomeForOwnerState1Phase7Observed.rngState)

  // Act: the actual worker reloads, applies the departure/no-op, and saves both public rows.
  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export async function assertSelectedView(input: AssertSelectedViewInput): Promise<void> {
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.fixture.gameId,
    turn: input.departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      input.departureView,
      AttackMoveTest.id,
      { fleet: input.attackerSource.id, planet: input.fixture.aliceHome.id },
      { strength: 20 },
    ),
  })
  await input.alice.client.gameplay.updateActionSubmission.mutate({
    gameId: input.fixture.gameId,
    turn: input.departureView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      input.departureView,
      MoveFleetImproved.id,
      { fleet: input.attackerSource.id, planet: input.fixture.aliceHome.id },
      { strength: 5 },
    ),
  })
  const selectedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.fixture.gameId })
  expect(selectedView.resources[ResourceType.INFLUENCE].uncommitted).toBe(selectedView.resources[ResourceType.INFLUENCE].total - 8)
  expect(selectedView.resources[ResourceType.FUEL].uncommitted).toBe(selectedView.resources[ResourceType.FUEL].total - 4)
  await processPublicTurn({
    clients: input.fixture.clients,
    gameId: input.fixture.gameId,
    turn: input.departureView.turn,
    turnProcessor: input.fixture.turnProcessor,
  })
}

export type AssertSelectedViewInput = {
  alice: AuthenticatedApiClient
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicHomeArrivalFixture>>
  departureView: PlayerView
  attackerSource: Fleet
}

export function assertPermuted(input: AssertPermutedInput): void {
  const permuted = replayObservedTurn(input.assertPermutedPhase9Observed, true)
  const expectedTargetForces = { [input.playerAId]: [22], [input.playerBId]: [] }

  assertOwnerFleetForces({ ...input, expectedTargetForces, permuted })
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

export function assertOwnerFleetForces(input: AssertOwnerFleetForcesInput): void {
  expect(ownerFleetForces(input.forward.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    input.expectedTargetForces,
  )
  expect(ownerFleetForces(input.permuted.resolved, input.fixture.playerIds, input.fixture.aliceHome.id)).toStrictEqual(
    input.expectedTargetForces,
  )
  expect(ownerFleetForces(input.forward.resolved, input.fixture.playerIds, input.fixture.bobHome.id)).toStrictEqual({
    [input.playerAId]: [8],
    [input.playerBId]: [],
  })
  expect(normalizedOutcomeSequence(input.forward.resolved)).toStrictEqual(normalizedOutcomeSequence(input.permuted.resolved))
  expect(input.forward.rngState).toStrictEqual(input.permuted.rngState)
  expect(
    Object.values(input.forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  ).toStrictEqual(
    Object.values(input.permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
  )
  expect(input.forward.resolved.removedFleetIds).toStrictEqual(
    expect.arrayContaining([input.attackJourney.id, input.ordinaryJourney.id, input.enemy.id]),
  )
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

export function assertOwnerIndex(input: AssertOwnerIndexInput): void {
  for (let ownerIndex = 0; ownerIndex < input.afterCombat.length; ownerIndex += 1) {
    const view = input.afterCombat[ownerIndex]
    const before = input.beforeCombatViews[ownerIndex]
    const ownerPlayerId = input.fixture.playerIds[ownerIndex]
    Assert.isDefined(view)
    Assert.isDefined(before)
    Assert.isDefined(ownerPlayerId)
    expect(view.fleets.find(({ id }) => id === input.initialFriendly.id)).toMatchObject({
      id: input.initialFriendly.id,
      name: input.initialFriendly.name,
      ownerPlayerId: input.playerAId,
      originPlanetId: input.fixture.aliceHome.id,
      strength: 22,
    })
    expect(view.fleets.find(({ id }) => id === input.enemy.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === input.attackJourney.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === input.ordinaryJourney.id)).toBeUndefined()
    expect(view.fleets.find(({ id }) => id === input.attackerSource.id)).toMatchObject({ id: input.attackerSource.id, strength: 8 })
    expect(view.actions.find(({ id }) => id === input.attackAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === input.ordinaryAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === input.buildAction.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    const aliceBuildInfluenceCost = ownerPlayerId === input.playerAId ? 2 : 0
    const aliceBuildMetalCost = ownerPlayerId === input.playerAId ? 1 : 0
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
