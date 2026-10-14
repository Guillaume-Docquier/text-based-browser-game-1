import { type RngState, Assert, Logger, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { required } from "shared/testing/required.ts"
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
import { getWorkerTieFundingRounds } from "../fleet-concurrency/gameplay.scenarios.ts"
import {
  PostgresColonizeWorkerRuleset,
  PostgresColonizeTickZeroPriorityRuleset,
  findStationaryFleetAt,
  fundingTargetsFor,
} from "../fleet-concurrency/gameplay.ts"

export async function assertUntouchedTarget(input: AssertUntouchedTargetInput): Promise<void> {
  expect(input.untouchedTarget.ownerPlayerId).toBeNull()
  expect(input.untouchedInitialView.fleets).toStrictEqual([])
  expect(input.untouchedInitialView.turn).toBe(1)

  // Public funding: ship40 costs2I/1M; the single GainMetal and GainFuel actions cover the supported movement costs.
  for (const fundingRound of getWorkerTieFundingRounds()) {
    const views = await input.readViews()
    for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
      const client = input.clients[ownerIndex]
      const view = views[ownerIndex]
      const home = input.homes[ownerIndex]
      Assert.isDefined(client)
      Assert.isDefined(view)
      Assert.isDefined(home)
      for (const actionDefinitionId of fundingRound.actionDefinitionIds) {
        await input.submit(client.client, view, actionDefinitionId, fundingTargetsFor(actionDefinitionId, home.id), {})
      }
    }
    await input.processDeadlineTurn(views[0].turn)
    const afterFundingTurn = await input.readViews()
    expect(afterFundingTurn.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([
      fundingRound.expectedInfluence,
      fundingRound.expectedInfluence,
    ])
  }

  const fundedViews = await input.readViews()
  for (let ownerIndex = 0; ownerIndex < input.clients.length; ownerIndex += 1) {
    const client = input.clients[ownerIndex]
    const view = fundedViews[ownerIndex]
    const home = input.homes[ownerIndex]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 53 })
    expect(view.resources[ResourceType.METAL]).toStrictEqual({ total: 4, uncommitted: 4 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
    const source = findStationaryFleetAt(view, view.player.id, home.id)
    Assert.isDefined(source)
    expect(source.strength).toBe(40)
    await input.submit(client.client, view, MoveFleetExceptional.id, { fleet: source.id, planet: input.target.id }, { strength: 35 })
    const selectedView = await client.client.gameplay.getPlayerView.query({ gameId: input.gameId })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 53, uncommitted: 50 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 1 })
  }
  await input.processDeadlineTurn(fundedViews[0].turn)
}

export type AssertUntouchedTargetInput = {
  untouchedTarget: Planet
  untouchedInitialView: PlayerView
  readViews: () => Promise<[PlayerView, PlayerView]>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  homes: Array<undefined | Planet>
  submit: SubmitCallback
  processDeadlineTurn: (turn: number) => Promise<void>
  target: Planet
  gameId: GameId
}

export function assertObservedPreResolutionRngState(input: AssertObservedPreResolutionRngStateInput): void {
  expect(input.observedPreResolutionRngState.spareNormal).toBeNull()
  expect([input.alice.account.id, input.bob.account.id]).toStrictEqual([
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ])
  expect(input.assertObservedPreResolutionRngStatePhase2Observed.ruleset.id).toBe(PostgresColonizeWorkerRuleset.id)
  expect(input.assertObservedPreResolutionRngStatePhase2Observed.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
    [...input.colonizeActionIds].toSorted(),
  )
  expect(required(input.assertObservedPreResolutionRngStatePhase2Observed.planets[input.target.id]).ownerPlayerId).toBeNull()
  expect(
    required(input.assertObservedPreResolutionRngStatePhase2Observed.players[input.stationedViews[0].player.id]).resources[
      ResourceType.INFLUENCE
    ],
  ).toBe(50)
  expect(
    required(input.assertObservedPreResolutionRngStatePhase2Observed.players[input.stationedViews[1].player.id]).resources[
      ResourceType.INFLUENCE
    ],
  ).toBe(50)
  for (const fleet of input.stationedFleets) {
    Assert.isDefined(fleet)
    expect(required(input.assertObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]).strength).toBe(35)
    expect(input.assertObservedPreResolutionRngStatePhase2Observed.fleets[fleet.id]?.movement).toBeUndefined()
  }

  const capturedInput = input.assertObservedPreResolutionRngStatePhase2Observed
  Logger.get().info("[C3-10 captured input before replay]", {
    targetOwner: capturedInput.planets[input.target.id]?.ownerPlayerId,
    submissions: capturedInput.submittedActions.map(({ id, playerId, selectedTargets, selectedInputs }) => ({
      id,
      playerId,
      selectedTargets,
      selectedInputs,
    })),
    contenders: input.stationedFleets.map((fleet) => {
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

export async function assertUntouchedAfter(input: AssertUntouchedAfterInput): Promise<void> {
  expect({ generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }).toStrictEqual(
    input.expectedNextRngState,
  )
  expect({ generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }).toStrictEqual(
    input.forwardReplay.rngState,
  )

  const untouchedAfter = await input.alice.client.gameplay.getPlayerView.query({ gameId: input.untouchedGameId })
  expect(untouchedAfter.turn).toBe(input.untouchedInitialView.turn)
  expect(untouchedAfter.fleets).toStrictEqual([])
  expect(untouchedAfter.resources).toStrictEqual(input.untouchedInitialView.resources)
  expect(
    required(untouchedAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === input.target.id)).ownerPlayerId,
  ).toBeNull()

  Logger.get().info("[C3-10 public worker receipt]", {
    gameId: input.gameId,
    untouchedGameId: input.untouchedGameId,
    seed: 147,
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    homes: [input.homeA, input.homeB].map((home) => ({ id: home.id, name: home.name, coordinates: home.coordinates })),
    distances: input.distances,
    observationTurn: input.observationView.turn,
    loadedRngState: input.observedPreResolutionRngState,
    loadedPlayers: Object.values(input.assertUntouchedAfterPhase3Observed.players).map(({ id, resources }) => ({
      id,
      influence: resources[ResourceType.INFLUENCE],
    })),
    loadedTargetOwner: input.assertUntouchedAfterPhase3Observed.planets[input.target.id]?.ownerPlayerId,
    independentlyPinnedContenders: [input.alice.account.id, input.bob.account.id],
    independentFirstTieDraw: input.firstTieShuffleDraw,
    independentExpectedOwner: input.expectedOwner,
    independentExpectedNextRngState: input.expectedNextRngState,
    persistedOwner: input.persistedOwner,
    persistedTargetForces: input.finalStrengths,
    persistedResources: [input.aliceAfter, input.bobAfter].map(({ player, resources }) => ({
      playerId: player.id,
      influence: resources[ResourceType.INFLUENCE].total,
      metal: resources[ResourceType.METAL].total,
      fuel: resources[ResourceType.FUEL].total,
    })),
    persistedNextRngState: { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal },
    replayNextRngState: input.forwardReplay.rngState,
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

export function assertCapturedInput2(input: AssertCapturedInput2Input): void {
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.ruleset.id).toBe(PostgresColonizeTickZeroPriorityRuleset.id)
  expect(required(input.assertAssertCapturedInputState1Phase4CapturedInput.planets[input.target.id]).ownerPlayerId).toBeNull()
  expect(
    required(input.assertAssertCapturedInputState1Phase4CapturedInput.players[input.alicePlayerId]).resources[ResourceType.INFLUENCE],
  ).toBe(95)
  expect(
    required(input.assertAssertCapturedInputState1Phase4CapturedInput.players[input.bobPlayerId]).resources[ResourceType.INFLUENCE],
  ).toBe(98)
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.fleets[input.stagedAlice.id]).toMatchObject({
    ownerPlayerId: input.alicePlayerId,
    originPlanetId: input.target.id,
    strength: 35,
  })
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.fleets[input.stagedAlice.id]?.movement).toBeUndefined()
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.fleets[input.stagedBob.id]).toMatchObject({
    ownerPlayerId: input.bobPlayerId,
    originPlanetId: input.homeB.id,
    strength: input.builtStrength,
  })
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.fleets[input.stagedBob.id]?.movement).toBeUndefined()
  expect(input.assertAssertCapturedInputState1Phase4CapturedInput.submittedActions.map(({ id }) => id).toSorted()).toStrictEqual(
    [input.aliceColonizeActionId, input.bobColonizeActionId].toSorted(),
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

export function assertPersistedAlice(input: AssertPersistedAliceInput): void {
  expect(input.persistedAlice).toMatchObject({ id: input.stagedAlice.id, strength: 15 })
  expect(input.persistedBob).toMatchObject({ id: input.bobArrival.id, strength: input.movingStrength })
  const bobHomeFleets = input.views[1].fleets.filter(({ originPlanetId }) => originPlanetId === input.homeB.id)

  assertScenarioState({ ...input, bobHomeFleets })
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

export function assertScenarioState(input: AssertScenarioStateInput): void {
  expect(
    input.bobHomeFleets
      .map(({ ownerPlayerId, movement, strength }) => ({ ownerPlayerId, movement, strength }))
      .toSorted((first, second) => first.strength - second.strength),
  ).toStrictEqual(
    input.bobHomeRemainderStrengths.map((strength) => ({
      ownerPlayerId: input.bobPlayerId,
      movement: undefined,
      strength,
    })),
  )
  expect(input.views[0].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 70, uncommitted: 70 })
  expect(input.views[1].resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 73, uncommitted: 73 })
  expect(input.views[0].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(input.views[1].resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(input.views[0].resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(input.views[1].resources[ResourceType.FUEL]).toStrictEqual({ total: 100, uncommitted: 100 })
  expect(input.views[0].actions.find(({ id }) => id === input.aliceColonizeActionId)).toMatchObject({
    selectedTargets: null,
    isInProgress: false,
  })
  expect(input.views[1].actions.find(({ id }) => id === input.bobColonizeActionId)).toMatchObject({
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

export function assertPersistedNextRngState(input: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.assertPersistedNextRngStatePhase6CapturedInput.rngState)
  expect(persistedNextRngState).toStrictEqual(input.replay.rngState)

  Logger.get().info("[C3-07 public tick-zero priority receipt]", {
    gameId: input.gameId,
    seed: 147,
    movingStrength: input.movingStrength,
    homes: [input.homeA, input.homeB].map(({ id, name, coordinates }) => ({ id, name, coordinates })),
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    routeDistances: { aliceStage: input.distances[0], bobColonize: input.distances[1] },
    stagedForces: { aliceAtTarget: input.stagedAlice.strength, bobBeforeDeparture: input.stagedBob.strength },
    attempts: {
      alice: { actionId: input.aliceColonizeActionId, selectedStrength: 35, tick: 0 },
      bob: { actionId: input.bobColonizeActionId, selectedStrength: input.movingStrength, speed: 5, tick: 10 },
    },
    replay: {
      owner: input.replay.resolved.planets[input.target.id]?.ownerPlayerId,
      outcomes: input.replay.actionOutcomes,
      nextRngState: input.replay.rngState,
    },
    persisted: {
      owner: input.findPlanetOwner(input.views[0], input.target.id),
      aliceForce: input.persistedAlice.strength,
      bobForce: input.persistedBob.strength,
      influence: input.views.map(({ resources }) => resources[ResourceType.INFLUENCE].total),
      colony: input.views.map(({ resources }) => resources[ResourceType.COLONY].total),
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

type SubmitCallback = (
  client: AuthenticatedApiClient["client"],
  view: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SelectedTargets>,
  selectedInputs: DeepUnbranded<SelectedInputs>,
) => Promise<string>
