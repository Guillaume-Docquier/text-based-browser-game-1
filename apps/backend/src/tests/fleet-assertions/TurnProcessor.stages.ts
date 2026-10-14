import { Assert, branded, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { BuildFleetStandard } from "shared/testing/test-ruleset/action-definitions/build-fleet.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect } from "vitest"
import type { Planet, PlayerView, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { Database } from "#lib/db/createDb.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ApiServer } from "#tests/ApiServer.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type {
  mulberry32FirstDraw as Capturedmulberry32FirstDraw,
  replayObservedTurn as CapturedreplayObservedTurn,
  mulberry32DrawSequence as Capturedmulberry32DrawSequence,
} from "#tests/fleet-worker/TurnProcessor.scenarios.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  processPublicTurn,
  observeTurnAndRollback,
  replayObservedTurn,
  mulberry32FirstDraw,
  mulberry32DrawSequence,
  normalizedOutcomeSequence,
  outcomeForOwner,
  ownerFleetForces,
  getActionToSubmintegrationTest,
} from "../fleet-worker/TurnProcessor.scenarios.ts"
import { AssaultWorkerRuleset } from "../fleet-worker/TurnProcessor.ts"
import { assertHomes, assertOwnerIndex, assertOutcomeB2, assertOutcomeB3 } from "./TurnProcessor.ts"

export async function createClientsSetup(input: CreateClientsSetupInput): Promise<CreateClientsSetupResult> {
  const bob = await input.apiServer.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })
  const clients = [input.alice, bob] as const
  const playerAId = branded<PlayerId>(input.alice.account.id)
  const playerBId = branded<PlayerId>(bob.account.id)
  const playerIds = [playerAId, playerBId] as const
  const turnInterval = Time.create(10, UnitOfTime.SECONDS)
  const { createdGameId: gameId } = await input.alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: AssaultWorkerRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await input.alice.client.games.startGame.mutate({ gameId })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: input.db, clock: input.clock })
  const initialView = await input.alice.client.gameplay.getPlayerView.query({ gameId })
  const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const target = planets.find(({ coordinates }) => coordinates === "45:83:40")
  Assert.isDefined(target)
  const homeA = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerAId)
  const homeB = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerBId)
  Assert.isDefined(homeA)
  Assert.isDefined(homeB)

  await assertHomes({ homeA, homeB, target, playerIds, clients, gameId, turnProcessor })

  const builtView = await input.alice.client.gameplay.getPlayerView.query({ gameId })
  const builtFleetA = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerAId && originPlanetId === homeA.id && movement === undefined,
  )
  const builtFleetB = builtView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) => ownerPlayerId === playerBId && originPlanetId === homeB.id && movement === undefined,
  )
  Assert.isDefined(builtFleetA)
  Assert.isDefined(builtFleetB)
  const builtFleets = [builtFleetA, builtFleetB] as const
  expect(builtFleets.map(({ strength }) => strength)).toStrictEqual([30, 20])
  const targetOwnerIndex = target.id === homeA.id ? 0 : target.id === homeB.id ? 1 : -1
  expect(targetOwnerIndex).toBeGreaterThanOrEqual(0)
  const movingClient = targetOwnerIndex === 0 ? bob : input.alice
  const movingFleet = targetOwnerIndex === 0 ? builtFleetB : builtFleetA
  return {
    clients,
    playerAId,
    playerBId,
    playerIds,
    gameId,
    turnProcessor,
    turnsRepository,
    planets,
    target,
    builtView,
    movingClient,
    movingFleet,
  }
}

export type CreateClientsSetupInput = { apiServer: ApiServer; alice: AuthenticatedApiClient; db: Database; clock: ControlledClock }

export type CreateClientsSetupResult = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  playerAId: PlayerId
  playerBId: PlayerId
  playerIds: readonly [PlayerId, PlayerId]
  gameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  planets: Planet[]
  target: Planet
  builtView: PlayerView
  movingClient: AuthenticatedApiClient
  movingFleet: Fleet
}

export async function createStationedSetup(input: CreateStationedSetupInput): Promise<CreateStationedSetupResult> {
  await input.movingClient.client.gameplay.updateActionSubmission.mutate({
    gameId: input.gameId,
    turn: input.builtView.turn,
    submittedActionTargets: getActionToSubmintegrationTest(
      input.builtView,
      MoveFleetExceptional.id,
      { fleet: input.movingFleet.id, planet: input.target.id },
      { strength: input.movingFleet.strength },
    ),
  })
  await processPublicTurn({ ...input, turn: input.builtView.turn })
  const stationedView = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.gameId })
  const stationedA = stationedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.playerAId && originPlanetId === input.target.id && movement === undefined,
  )
  const stationedB = stationedView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === input.playerBId && originPlanetId === input.target.id && movement === undefined,
  )
  Assert.isDefined(stationedA)
  Assert.isDefined(stationedB)
  const stationed = [stationedA, stationedB] as const
  expect(stationed.map(({ strength }) => strength)).toStrictEqual([30, 20])

  // Act: both owners submit the same pooled stationary Assault instance, then publicly close the turn.
  const preAssaultViews = await Promise.all(
    input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
  )
  const actionIds: string[] = []
  return { stationed, preAssaultViews, actionIds }
}

export type CreateStationedSetupInput = {
  movingClient: AuthenticatedApiClient
  gameId: GameId
  builtView: PlayerView
  movingFleet: Fleet
  target: Planet
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  playerAId: PlayerId
  playerBId: PlayerId
}

export type CreateStationedSetupResult = { stationed: readonly [Fleet, Fleet]; preAssaultViews: PlayerView[]; actionIds: string[] }

export async function createObservedSetup(input: CreateObservedSetupInput): Promise<CreateObservedSetupResult> {
  expect(input.actionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  const assaultTurn = input.preAssaultViews[0]
  Assert.isDefined(assaultTurn)
  await Promise.all(
    input.clients.map(
      async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId: input.gameId, turn: assaultTurn.turn, isReady: true }),
    ),
  )

  // Act: capture the production-parsed turn inside a transaction that must roll back every processing mutation.
  const observed = await observeTurnAndRollback({ ...input, turn: assaultTurn.turn })

  // Assert: the shared replay independently predicts the canonical shuffled order and full per-owner outcome sequence.
  expect(observed.submittedActions).toHaveLength(2)
  expect(observed.submittedActions.map(({ id }) => id)).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  expect(
    Object.values(observed.fleets)
      .filter(({ ownerPlayerId, originPlanetId }) => input.playerIds.includes(ownerPlayerId) && originPlanetId === input.target.id)
      .map(({ strength }) => strength)
      .toSorted((first, second) => second - first),
  ).toStrictEqual([30, 20])
  const draw = mulberry32FirstDraw(observed.rngState.generatorState)
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(permuted.rngState)
  expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
    permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
  )
  expect(
    Object.values(forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  ).toStrictEqual(
    Object.values(permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  )
  const outcomeA = outcomeForOwner(forward.resolved, input.playerIds[0])
  const outcomeB = outcomeForOwner(forward.resolved, input.playerIds[1])
  Assert.isDefined(outcomeA)
  Assert.isDefined(outcomeB)

  const assertOutcomeBPhase2Value1 = draw.value
  const assertOutcomeBPhase2Observed = observed
  return { observed, draw, forward, outcomeA, outcomeB, assertOutcomeBPhase2Value1, assertOutcomeBPhase2Observed }
}

export type CreateObservedSetupInput = {
  actionIds: string[]
  preAssaultViews: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  playerIds: readonly [PlayerId, PlayerId]
  target: Planet
}

export type CreateObservedSetupResult = {
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  assertOutcomeBPhase2Value1: number
  assertOutcomeBPhase2Observed: ReturnType<typeof reverseWorkerInputEnumeration>
}

export type CreateObservedSetup2Input = {
  assaultActionIds: string[]
  preAssaultViews: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  homes: readonly [Planet, Planet, Planet]
}

export type CreateObservedSetup2Result = {
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  rngSequence: ReturnType<typeof Capturedmulberry32DrawSequence>
  draw: { value: number; nextGeneratorState: number }
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  expectedBuildNames: string[]
  replayBuilds: Array<{ id: string; name: string; ownerPlayerId: PlayerId; originPlanetId: string; strength: number }>
}

export type CreateObservedSetup3Input = {
  assaultActionIds: string[]
  preAssaultViews: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  db: Database
  clock: ControlledClock
  turnsRepository: TurnsRepository
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  stationed: readonly [Fleet, Fleet, Fleet]
}

export type CreateObservedSetup3Result = {
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetA: Fleet
  fleetB: Fleet
  fleetC: Fleet
  assertOutcomeBPhase7Value1: number
  assertOutcomeBPhase7Observed: ReturnType<typeof reverseWorkerInputEnumeration>
}

export async function createObservedSetup2(input: CreateObservedSetup2Input): Promise<CreateObservedSetup2Result> {
  expect(input.assaultActionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  const assaultTurn = input.preAssaultViews[0]
  Assert.isDefined(assaultTurn)
  await Promise.all(
    input.clients.map(
      async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId: input.gameId, turn: assaultTurn.turn, isReady: true }),
    ),
  )

  // Act: observe the parsed production input with an intentional transaction rollback; no gameplay setup uses SQL.
  const observed = await observeTurnAndRollback({ ...input, turn: assaultTurn.turn })

  // Assert: replay the independent captured input in both row orders and check the literal branch selected by Mulberry32.
  expect(observed.submittedActions).toHaveLength(5)
  const observedBuildActions = observed.submittedActions.filter(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  expect(
    observedBuildActions
      .map(({ id, playerId }) => ({ id, playerId }))
      .toSorted((left, right) => compareOrdinalStrings(left.playerId, right.playerId)),
  ).toStrictEqual(input.playerIds.map((playerId) => ({ id: "BUILD_FLEET_STANDARD_1", playerId })))
  expect(
    observed.submittedActions.filter(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id).map(({ id }) => id),
  ).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  const rngSequence = mulberry32DrawSequence(observed.rngState.generatorState, 4)
  expect(rngSequence.draws).toHaveLength(4)
  const draw = rngSequence.draws[3]
  Assert.isDefined(draw)
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(permuted.rngState)
  expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
    permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
  )
  expect(
    Object.values(forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  ).toStrictEqual(
    Object.values(permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  )
  expect(forward.rngState.generatorState).toBe(rngSequence.finalGeneratorState)
  const expectedBuildNames = rngSequence.draws.slice(0, 3).map(({ value }) => "fleet " + (999 + Math.floor(value * 999001)))
  expect(expectedBuildNames).toHaveLength(3)
  const replayBuilds: Array<{
    id: string
    name: string
    ownerPlayerId: PlayerId
    originPlanetId: string
    strength: number
  }> = []

  assertOwnerIndex({ ...input, expectedBuildNames, forward, replayBuilds, permuted })
  return { observed, rngSequence, draw, forward, expectedBuildNames, replayBuilds }
}

export async function createAfterCombatViewsSetup(input: CreateAfterCombatViewsSetupInput): Promise<CreateAfterCombatViewsSetupResult> {
  const assaultActionIdA = input.assaultActionIds[0]
  const assaultActionIdB = input.assaultActionIds[1]
  Assert.isDefined(assaultActionIdA)
  Assert.isDefined(assaultActionIdB)
  const outcomeA = outcomeForOwner(input.forward.resolved, input.playerIds[0], assaultActionIdA)
  const outcomeB = outcomeForOwner(input.forward.resolved, input.playerIds[1], assaultActionIdB)
  Assert.isDefined(outcomeA)
  Assert.isDefined(outcomeB)
  const fleetA = input.stationed[0]
  const fleetB = input.stationed[1]
  const fleetC = input.stationed[2]
  Assert.isDefined(fleetA)
  Assert.isDefined(fleetB)
  Assert.isDefined(fleetC)

  const assertOutcomeBPhase5Value1 = input.draw.value
  const assertOutcomeBPhase5Observed = input.observed

  await assertOutcomeB2({ ...input, assertOutcomeBPhase5Value1, outcomeB, fleetB, outcomeA, fleetA, fleetC, assertOutcomeBPhase5Observed })

  const afterCombatViews = await Promise.all(
    input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
  )
  const actualForces = Object.fromEntries(
    input.playerIds.map((playerId) => [
      playerId,
      afterCombatViews[0]?.fleets
        .filter(({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && originPlanetId === input.target.id)
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
  expect(actualForces).toStrictEqual(ownerFleetForces(input.forward.resolved, input.playerIds, input.target.id))
  return { afterCombatViews, actualForces }
}

export type CreateAfterCombatViewsSetupInput = {
  assaultActionIds: string[]
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  stationed: readonly [Fleet, Fleet, Fleet]
  draw: { value: number; nextGeneratorState: number }
  observed: ReturnType<typeof reverseWorkerInputEnumeration>
  target: Planet
  playerAId: PlayerId
  playerBId: PlayerId
  playerCId: PlayerId
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
}

export type CreateAfterCombatViewsSetupResult = { afterCombatViews: PlayerView[]; actualForces: Record<string, undefined | number[]> }

export type CreateAfterCombatViewsSetup2Input = {
  assertOutcomeBPhase7Value1: number
  outcomeB: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetB: Fleet
  target: Planet
  outcomeA: Readonly<{ type: "RESOLVED"; result: string }> | Readonly<{ type: "PREVENTED"; reason: string }>
  fleetA: Fleet
  forward: ReturnType<typeof CapturedreplayObservedTurn>
  playerIds: readonly [PlayerId, PlayerId, PlayerId]
  playerAId: PlayerId
  playerBId: PlayerId
  playerCId: PlayerId
  fleetC: Fleet
  draw: ReturnType<typeof Capturedmulberry32FirstDraw>
  assertOutcomeBPhase7Observed: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
}

export type CreateAfterCombatViewsSetup2Result = { afterCombatViews: PlayerView[]; actualForces: Record<string, undefined | number[]> }

export async function createObservedSetup3(input: CreateObservedSetup3Input): Promise<CreateObservedSetup3Result> {
  expect(input.assaultActionIds).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  const assaultTurn = input.preAssaultViews[0]
  Assert.isDefined(assaultTurn)
  await Promise.all(
    input.clients.map(
      async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId: input.gameId, turn: assaultTurn.turn, isReady: true }),
    ),
  )

  // Act: observe the parsed production input with an intentional transaction rollback; no gameplay setup uses SQL.
  const observed = await observeTurnAndRollback({ ...input, turn: assaultTurn.turn })

  // Assert: replay the independent captured input in both row orders and check the literal branch selected by Mulberry32.
  expect(observed.submittedActions).toHaveLength(2)
  expect(observed.submittedActions.map(({ id }) => id)).toStrictEqual(["TEST_STATIONARY_ASSAULT_1", "TEST_STATIONARY_ASSAULT_1"])
  const draw = mulberry32FirstDraw(observed.rngState.generatorState)
  const forward = replayObservedTurn(observed, false)
  const permuted = replayObservedTurn(observed, true)
  expect(normalizedOutcomeSequence(forward.resolved)).toStrictEqual(normalizedOutcomeSequence(permuted.resolved))
  expect(forward.rngState).toStrictEqual(permuted.rngState)
  expect(forward.resolved.removedFleetIds.toSorted(compareOrdinalStrings)).toStrictEqual(
    permuted.resolved.removedFleetIds.toSorted(compareOrdinalStrings),
  )
  expect(
    Object.values(forward.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  ).toStrictEqual(
    Object.values(permuted.resolved.fleets)
      .map(({ id, name, ownerPlayerId, originPlanetId, strength }) => ({ id, name, ownerPlayerId, originPlanetId, strength }))
      .toSorted((left, right) => compareOrdinalStrings(left.id, right.id)),
  )
  const assaultActionIdA = input.assaultActionIds[0]
  const assaultActionIdB = input.assaultActionIds[1]
  Assert.isDefined(assaultActionIdA)
  Assert.isDefined(assaultActionIdB)
  const outcomeA = outcomeForOwner(forward.resolved, input.playerIds[0], assaultActionIdA)
  const outcomeB = outcomeForOwner(forward.resolved, input.playerIds[1], assaultActionIdB)
  Assert.isDefined(outcomeA)
  Assert.isDefined(outcomeB)
  const fleetA = input.stationed[0]
  const fleetB = input.stationed[1]
  const fleetC = input.stationed[2]
  Assert.isDefined(fleetA)
  Assert.isDefined(fleetB)
  Assert.isDefined(fleetC)

  const assertOutcomeBPhase7Value1 = draw.value
  const assertOutcomeBPhase7Observed = observed
  return { observed, draw, forward, outcomeA, outcomeB, fleetA, fleetB, fleetC, assertOutcomeBPhase7Value1, assertOutcomeBPhase7Observed }
}

export async function createAfterCombatViewsSetup2(input: CreateAfterCombatViewsSetup2Input): Promise<CreateAfterCombatViewsSetup2Result> {
  await assertOutcomeB3({
    assertOutcomeBPhase7Value1: input.assertOutcomeBPhase7Value1,
    outcomeB: input.outcomeB,
    fleetB: input.fleetB,
    target: input.target,
    outcomeA: input.outcomeA,
    fleetA: input.fleetA,
    forward: input.forward,
    playerIds: input.playerIds,
    playerAId: input.playerAId,
    playerBId: input.playerBId,
    playerCId: input.playerCId,
    fleetC: input.fleetC,
    draw: input.draw,
    assertOutcomeBPhase7Observed: input.assertOutcomeBPhase7Observed,
    turnProcessor: input.turnProcessor,
  })

  const afterCombatViews = await Promise.all(
    input.clients.map(async ({ client }) => await client.gameplay.getPlayerView.query({ gameId: input.gameId })),
  )
  const actualForces = Object.fromEntries(
    input.playerIds.map((playerId) => [
      playerId,
      afterCombatViews[0]?.fleets
        .filter(({ ownerPlayerId, originPlanetId }) => ownerPlayerId === playerId && originPlanetId === input.target.id)
        .map(({ strength }) => strength)
        .toSorted((first, second) => first - second),
    ]),
  )
  expect(actualForces).toStrictEqual(ownerFleetForces(input.forward.resolved, input.playerIds, input.target.id))
  return { afterCombatViews, actualForces }
}
