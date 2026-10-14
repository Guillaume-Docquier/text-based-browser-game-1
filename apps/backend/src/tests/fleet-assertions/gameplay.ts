import { type RngState, Assert, Logger, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Planet, SelectedTargets, SelectedInputs, Fleet, PlayerView } from "#api/types.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type {
  reverseWorkerInputEnumeration as CapturedreverseWorkerInputEnumeration,
  replayWorkerInput as CapturedreplayWorkerInput,
} from "#tests/fleet-concurrency/gameplay.ts"
import { workerTieFundingRounds } from "../fleet-concurrency/gameplay.scenarios.ts"
import {
  PostgresColonizeWorkerRuleset,
  PostgresColonizeTickZeroPriorityRuleset,
  findStationaryFleetAt,
  fundingTargetsFor,
} from "../fleet-concurrency/gameplay.ts"

export async function assertUntouchedTarget({
  untouchedTarget,
  untouchedInitialView,
  readViews,
  clients,
  homes,
  submit,
  processDeadlineTurn,
  target,
  gameId,
}: AssertUntouchedTargetInput): Promise<void> {
  expect(untouchedTarget.ownerPlayerId).toBeNull()
  expect(untouchedInitialView.fleets).toStrictEqual([])
  expect(untouchedInitialView.turn).toBe(1)

  // Public funding: ship40 costs2I/1M; the single GainMetal and GainFuel actions cover the supported movement costs.
  for (const fundingRound of workerTieFundingRounds) {
    const views = await readViews()
    for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
      const client = clients[ownerIndex]
      const view = views[ownerIndex]
      const home = homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      for (const actionDefinitionId of fundingRound.actionDefinitionIds) {
        await submit(client.client, view, actionDefinitionId, fundingTargetsFor(actionDefinitionId, home.id), {})
      }
    }
    await processDeadlineTurn(views[0].turn)
    const afterFundingTurn = await readViews()
    expect(afterFundingTurn.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([
      fundingRound.expectedInfluence,
      fundingRound.expectedInfluence,
    ])
  }

  const fundedViews = await readViews()
  for (let ownerIndex = 0; ownerIndex < clients.length; ownerIndex += 1) {
    const client = clients[ownerIndex]
    const view = fundedViews[ownerIndex]
    const home = homes[ownerIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 53 })
    expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
    const source = findStationaryFleetAt(view, view.player.id, home.id)
    Assert.isDefined(source)
    expect(source.strength).toBe(40)
    await submit(client.client, view, MoveFleetExceptional.id, { fleet: source.id, planet: target.id }, { strength: 35 })
    const selectedView = await client.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 50 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 1 })
  }
  await processDeadlineTurn(fundedViews[0].turn)
}

export type AssertUntouchedTargetInput = {
  untouchedTarget: Planet
  untouchedInitialView: PlayerView
  readViews: () => Promise<[PlayerView, PlayerView]>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  homes: Array<undefined | Planet>
  submit: (
    client: AuthenticatedApiClient["client"],
    view: PlayerView,
    actionDefinitionId: ActionDefinitionId,
    selectedTargets: DeepUnbranded<SelectedTargets>,
    selectedInputs: DeepUnbranded<SelectedInputs>,
  ) => Promise<string>
  processDeadlineTurn: (turn: number) => Promise<void>
  target: Planet
  gameId: GameId
}

export function assertObservedPreResolutionRngState({
  observedPreResolutionRngState,
  alice,
  bob,
  assertObservedPreResolutionRngStatePhase2Observed,
  colonizeActionIds,
  target,
  stationedViews,
  stationedFleets,
}: AssertObservedPreResolutionRngStateInput): void {
  expect(observedPreResolutionRngState.spareNormal).toBeNull()
  expect([alice.account.id, bob.account.id]).toStrictEqual(["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"])
  expect(assertObservedPreResolutionRngStatePhase2Observed.ruleset.id).toBe(PostgresColonizeWorkerRuleset.id)
  expect(assertObservedPreResolutionRngStatePhase2Observed.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
    [...colonizeActionIds].toSorted(),
  )
  expect(assertObservedPreResolutionRngStatePhase2Observed.planets[target.id]?.ownerPlayerId).toBeNull()
  expect(assertObservedPreResolutionRngStatePhase2Observed.players[stationedViews[0].player.id]?.resources[ResourceType.INFLUENCE]).toBe(50)
  expect(assertObservedPreResolutionRngStatePhase2Observed.players[stationedViews[1].player.id]?.resources[ResourceType.INFLUENCE]).toBe(50)
  for (const fleet of stationedFleets) {
    Assert.isDefined(fleet)
    expect(assertObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]?.strength).toBe(35)
    expect(assertObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]?.movement).toBeUndefined()
  }

  const capturedInput = assertObservedPreResolutionRngStatePhase2Observed
  Logger.get().info("[C3-10 captured input before replay]", {
    targetOwner: capturedInput.planets[target.id]?.ownerPlayerId,
    submissions: capturedInput.submittedActions.map(({ id, playerId, selectedTargets, selectedInputs }) => ({
      id,
      playerId,
      selectedTargets,
      selectedInputs,
    })),
    contenders: stationedFleets.map((fleet) => {
      Assert.isDefined(fleet)
      return {
        id: fleet.id,
        ownerPlayerId: fleet.ownerPlayerId,
        strength: capturedInput.fleets[fleet.id]?.strength,
        ownerState: capturedInput.players[fleet.ownerPlayerId]?.resources[ResourceType.INFLUENCE],
      }
    }),
  })
}

export type AssertObservedPreResolutionRngStateInput = {
  observedPreResolutionRngState: RngState<number>
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  assertObservedPreResolutionRngStatePhase2Observed: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  colonizeActionIds: string[]
  target: Planet
  stationedViews: [PlayerView, PlayerView]
  stationedFleets: Array<undefined | Fleet>
}

export async function assertUntouchedAfter({
  savedNextTurn,
  expectedNextRngState,
  forwardReplay,
  alice,
  untouchedGameId,
  untouchedInitialView,
  target,
  gameId,
  homeA,
  homeB,
  distances,
  observationView,
  observedPreResolutionRngState,
  assertUntouchedAfterPhase3Observed,
  bob,
  firstTieShuffleDraw,
  expectedOwner,
  persistedOwner,
  finalStrengths,
  aliceAfter,
  bobAfter,
}: AssertUntouchedAfterInput): Promise<void> {
  expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(expectedNextRngState)
  expect({ generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }).toStrictEqual(
    forwardReplay.rngState,
  )

  const untouchedAfter = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
  expect(untouchedAfter.turn).toBe(untouchedInitialView.turn)
  expect(untouchedAfter.fleets).toStrictEqual([])
  expect(untouchedAfter.resources).toStrictEqual(untouchedInitialView.resources)
  expect(untouchedAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  Logger.get().info("[C3-10 public worker receipt]", {
    gameId,
    untouchedGameId,
    seed: 147,
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    homes: [homeA, homeB].map((home) => ({ id: home.id, name: home.name, coordinates: home.coordinates })),
    distances,
    observationTurn: observationView.turn,
    loadedRngState: observedPreResolutionRngState,
    loadedPlayers: Object.values(assertUntouchedAfterPhase3Observed.players).map(({ id, resources }) => ({
      id,
      influence: resources[ResourceType.INFLUENCE],
    })),
    loadedTargetOwner: assertUntouchedAfterPhase3Observed.planets[target.id]?.ownerPlayerId,
    independentlyPinnedContenders: [alice.account.id, bob.account.id],
    independentFirstTieDraw: firstTieShuffleDraw,
    independentExpectedOwner: expectedOwner,
    independentExpectedNextRngState: expectedNextRngState,
    persistedOwner,
    persistedTargetForces: finalStrengths,
    persistedResources: [aliceAfter, bobAfter].map(({ player, resources }) => ({
      playerId: player.id,
      influence: resources[ResourceType.INFLUENCE].total,
      metal: resources[ResourceType.METAL].total,
      fuel: resources[ResourceType.FUEL].total,
    })),
    persistedNextRngState: { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal },
    replayNextRngState: forwardReplay.rngState,
  })
}

export type AssertUntouchedAfterInput = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  expectedNextRngState: { generatorState: number; spareNormal: null | number }
  forwardReplay: ReturnType<typeof CapturedreplayWorkerInput>
  alice: AuthenticatedApiClient
  untouchedGameId: GameId
  untouchedInitialView: PlayerView
  target: Planet
  gameId: GameId
  homeA: Planet
  homeB: Planet
  distances: number[]
  observationView: PlayerView
  observedPreResolutionRngState: RngState<number>
  assertUntouchedAfterPhase3Observed: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  bob: AuthenticatedApiClient
  firstTieShuffleDraw: number
  expectedOwner: PlayerId
  persistedOwner: undefined | null | PlayerId
  finalStrengths: Array<{ playerId: PlayerId; strength: number }>
  aliceAfter: PlayerView
  bobAfter: PlayerView
}

export function assertCapturedInput2({
  assertAssertCapturedInputState1Phase4CapturedInput,
  target,
  alicePlayerId,
  bobPlayerId,
  stagedAlice,
  stagedBob,
  homeB,
  builtStrength,
  aliceColonizeActionId,
  bobColonizeActionId,
}: AssertCapturedInput2Input): void {
  expect(assertAssertCapturedInputState1Phase4CapturedInput.ruleset.id).toBe(PostgresColonizeTickZeroPriorityRuleset.id)
  expect(assertAssertCapturedInputState1Phase4CapturedInput.planets[target.id]?.ownerPlayerId).toBeNull()
  expect(assertAssertCapturedInputState1Phase4CapturedInput.players[alicePlayerId]?.resources[ResourceType.INFLUENCE]).toBe(95)
  expect(assertAssertCapturedInputState1Phase4CapturedInput.players[bobPlayerId]?.resources[ResourceType.INFLUENCE]).toBe(98)
  expect(assertAssertCapturedInputState1Phase4CapturedInput.fleets[stagedAlice.id]).toMatchObject({
    ownerPlayerId: alicePlayerId,
    originPlanetId: target.id,
    strength: 35,
  })
  expect(assertAssertCapturedInputState1Phase4CapturedInput.fleets[stagedAlice.id]?.movement).toBeUndefined()
  expect(assertAssertCapturedInputState1Phase4CapturedInput.fleets[stagedBob.id]).toMatchObject({
    ownerPlayerId: bobPlayerId,
    originPlanetId: homeB.id,
    strength: builtStrength,
  })
  expect(assertAssertCapturedInputState1Phase4CapturedInput.fleets[stagedBob.id]?.movement).toBeUndefined()
  expect(assertAssertCapturedInputState1Phase4CapturedInput.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
    [aliceColonizeActionId, bobColonizeActionId].toSorted(),
  )
}

export type AssertCapturedInput2Input = {
  assertAssertCapturedInputState1Phase4CapturedInput: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  target: Planet
  alicePlayerId: PlayerId
  bobPlayerId: PlayerId
  stagedAlice: Fleet
  stagedBob: Fleet
  homeB: Planet
  builtStrength: 40 | 70
  aliceColonizeActionId: string
  bobColonizeActionId: string
}

export function assertPersistedAlice({
  persistedAlice,
  stagedAlice,
  persistedBob,
  bobArrival,
  movingStrength,
  views,
  homeB,
  bobHomeRemainderStrengths,
  bobPlayerId,
  aliceColonizeActionId,
  bobColonizeActionId,
}: AssertPersistedAliceInput): void {
  expect(persistedAlice).toMatchObject({ id: stagedAlice.id, strength: 15 })
  expect(persistedBob).toMatchObject({ id: bobArrival.id, strength: movingStrength })
  const bobHomeFleets = views[1].fleets.filter(({ originPlanetId }) => originPlanetId === homeB.id)

  assertScenarioState({ bobHomeFleets, bobHomeRemainderStrengths, bobPlayerId, views, aliceColonizeActionId, bobColonizeActionId })
}

export type AssertPersistedAliceInput = {
  persistedAlice: Fleet
  stagedAlice: Fleet
  persistedBob: Fleet
  bobArrival: ResolutionFleet
  movingStrength: 35 | 70
  views: [PlayerView, PlayerView]
  homeB: Planet
  bobHomeRemainderStrengths: readonly [5] | readonly []
  bobPlayerId: PlayerId
  aliceColonizeActionId: string
  bobColonizeActionId: string
}

export function assertScenarioState({
  bobHomeFleets,
  bobHomeRemainderStrengths,
  bobPlayerId,
  views,
  aliceColonizeActionId,
  bobColonizeActionId,
}: AssertScenarioStateInput): void {
  expect(
    bobHomeFleets
      .map(({ ownerPlayerId, movement, strength }) => ({ ownerPlayerId, movement, strength }))
      .toSorted((first, second) => first.strength - second.strength),
  ).toStrictEqual(
    bobHomeRemainderStrengths.map((strength) => ({
      ownerPlayerId: bobPlayerId,
      movement: undefined,
      strength,
    })),
  )
  expect(views[0].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 70, uncommitted: 70 })
  expect(views[1].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 73, uncommitted: 73 })
  expect(views[0].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(views[1].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(views[0].resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(views[1].resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(views[0].actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(views[1].actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
}

export type AssertScenarioStateInput = {
  bobHomeFleets: Fleet[]
  bobHomeRemainderStrengths: readonly [5] | readonly []
  bobPlayerId: PlayerId
  views: [PlayerView, PlayerView]
  aliceColonizeActionId: string
  bobColonizeActionId: string
}

export function assertPersistedNextRngState({
  savedNextTurn,
  assertPersistedNextRngStatePhase6CapturedInput,
  replay,
  gameId,
  movingStrength,
  homeA,
  homeB,
  target,
  distances,
  stagedAlice,
  stagedBob,
  aliceColonizeActionId,
  bobColonizeActionId,
  findPlanetOwner,
  views,
  persistedAlice,
  persistedBob,
}: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(assertPersistedNextRngStatePhase6CapturedInput.rngState)
  expect(persistedNextRngState).toStrictEqual(replay.rngState)

  Logger.get().info("[C3-07 public tick-zero priority receipt]", {
    gameId,
    seed: 147,
    movingStrength,
    homes: [homeA, homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
    routeDistances: { aliceStage: distances[0], bobColonize: distances[1] },
    stagedForces: { aliceAtTarget: stagedAlice.strength, bobBeforeDeparture: stagedBob.strength },
    attempts: {
      alice: { actionId: aliceColonizeActionId, selectedStrength: 35, tick: 0 },
      bob: { actionId: bobColonizeActionId, selectedStrength: movingStrength, speed: 5, tick: 10 },
    },
    replay: {
      owner: replay.resolved.planets[target.id]?.ownerPlayerId,
      outcomes: replay.actionOutcomes,
      nextRngState: replay.rngState,
    },
    persisted: {
      owner: findPlanetOwner(views[0], target.id),
      aliceForce: persistedAlice.strength,
      bobForce: persistedBob.strength,
      influence: views.map(({ resources }) => resources[ResourceType.INFLUENCE].total),
      colony: views.map(({ resources }) => resources[ResourceType.COLONY].total),
      nextRngState: persistedNextRngState,
    },
  })
}

export type AssertPersistedNextRngStateInput = {
  savedNextTurn: {
    gameId: GameId
    turn: number
    status: "COLLECTING_ACTIONS" | "AWAITING_PROCESSING" | "PROCESSING" | "COMPLETED"
    startedAt: ReturnType<typeof normalizeApiDate>
    endsAt: ReturnType<typeof normalizeApiDate>
    closedAt: null | ReturnType<typeof normalizeApiDate>
    rngGeneratorState: number
    rngSpareNormal: null | number
  }
  assertPersistedNextRngStatePhase6CapturedInput: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInput>
  gameId: GameId
  movingStrength: 35 | 70
  homeA: Planet
  homeB: Planet
  target: Planet
  distances: number[]
  stagedAlice: Fleet
  stagedBob: Fleet
  aliceColonizeActionId: string
  bobColonizeActionId: string
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
  views: [PlayerView, PlayerView]
  persistedAlice: Fleet
  persistedBob: Fleet
}
