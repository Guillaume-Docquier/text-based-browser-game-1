import { Assert } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { NonNegativeSafeInteger } from "shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { expect } from "vitest"
import type { Fleet, Planet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
  processTurnWithReplay as CapturedprocessTurnWithReplay,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getPlanets, getFleetAt, processTurn, processTurnWithReplay } from "../colonization/gameplay.colonization.scenarios.ts"
import {
  SeedOutpostHere,
  BuildFleet35,
  BuildFleet48,
  BuildFleet70,
  logReceipt,
  required,
  playerIdFor,
  findPublicFleet,
  findPlayerAction,
  submitAction,
  readViews,
} from "../colonization/gameplay.colonization.ts"
import type { AssertFindPlayerAction2Input } from "./gameplay.colonization.stationary.ts"

export async function assertFindPlayerAction2(input: AssertFindPlayerAction2Input): Promise<void> {
  expect(findPlayerAction(input.workerInput.submittedActions, input.colonizeActionId, playerIdFor(input.player))).toMatchObject({
    actionDefinitionId: SeedOutpostHere.id,
    selectedTargets: { force: input.stationary.id, site: input.target.id },
    selectedInputs: {},
  })
  expect(input.workerInput.ruleset.actionDefinitions[SeedOutpostHere.id]).toMatchObject({
    id: "TEST_SEED_OUTPOST_HERE",
    name: "Seed Outpost Here",
    tier: "IMPROVED",
    targets: {
      force: { targetType: "FLEET" },
      site: { targetType: "PLANET" },
    },
    effects: [{ type: "FLEET_COLONIZE", parameters: { strengthRequirement: 30 } }],
  })
  expect(input.assertFindPlayerActionState1Resolved.removedFleetIds).toContain(input.stationary.id)
  expect(input.assertFindPlayerActionState1Resolved.fleets[input.stationary.id]).toBeUndefined()
  expect(input.assertFindPlayerActionState1Resolved.planets[input.target.id]?.ownerPlayerId).toBe(playerIdFor(input.player))
  expect(input.assertFindPlayerActionState1Resolved.planetOwnershipChanges).toStrictEqual([
    { planetId: input.target.id, ownerPlayerId: playerIdFor(input.player) },
  ])
  expect(input.replay.nextRngState).toStrictEqual(input.workerInput.rngState)

  expect(await input.turnProcessor.processNextDueTurn()).toBe("processed")
}

export function assertScenarioState2(input: AssertScenarioState2Input): void {
  expect({
    id: input.target.id,
    name: input.target.name,
    coordinates: input.target.coordinates,
    x: input.target.x,
    y: input.target.y,
  }).toStrictEqual({
    id: "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b",
    name: "planet 457985",
    coordinates: "54:59:10",
    x: 49.41298329646574,
    y: 55.182944416215065,
  })
  expect(input.homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y }))).toStrictEqual([
    {
      id: "2e5272ce-7a3a-545c-ab41-a924ca3bb5b5",
      name: "planet 624762",
      coordinates: "55:19:35",
      x: 59.252656901227056,
      y: 51.03193990849681,
    },
    {
      id: "7262a26b-70f2-5f0b-8996-55211b146f71",
      name: "planet 483980",
      coordinates: "54:86:30",
      x: 46.68780205926124,
      y: 58.26889186923308,
    },
    {
      id: "e38464f2-ed30-5425-929d-47b6f76cde94",
      name: "planet 811907",
      coordinates: "34:91:45",
      x: 41.62708888195861,
      y: 39.759154606188055,
    },
  ])
}

export type AssertScenarioState2Input = { target: Planet; homes: Planet[] }

export async function assertDistances({
  distances,
  target,
  clients,
  views,
  homes,
  gameId,
  clock,
  turnsRepository,
  turnProcessor,
  alice,
  homeIdsByPlayer,
  carol,
}: AssertDistancesInput): Promise<AssertDistancesResult> {
  expect(distances[0]).toBeCloseTo(10.679420165502142, 12)
  expect(distances[1]).toBeCloseTo(4.116999448433268, 12)
  expect(distances[2]).toBeCloseTo(17.277541605730438, 12)
  expect(target.ownerPlayerId).toBeNull()

  const buildDefinitions = [BuildFleet35, BuildFleet70, BuildFleet48] as const
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index]
    const view = views[index]
    const home = homes[index]
    const buildDefinition = buildDefinitions[index]
    Assert.isDefined(client)
    Assert.isDefined(view)
    Assert.isDefined(home)
    Assert.isDefined(buildDefinition)
    await submitAction({
      client: client.client,
      gameId,
      view,
      actionDefinitionId: buildDefinition.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
  }
  await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
  views = await readViews(clients, gameId)

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: {
      fleet: getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), required(homes[0]).id, 35).id,
      planet: target.id,
    },
    selectedInputs: { strength: 35 },
  })
  await submitAction({
    client: carol.client,
    gameId,
    view: required(views[2]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: {
      fleet: getFleetAt(required(views[2]), required(homeIdsByPlayer[2]), required(homes[2]).id, 48).id,
      planet: target.id,
    },
    selectedInputs: { strength: 48 },
  })

  return { views }
}

export type AssertDistancesInput = {
  distances: number[]
  target: Planet
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  views: PlayerView[]
  homes: Planet[]
  gameId: GameId
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  alice: AuthenticatedApiClient
  homeIdsByPlayer: PlayerId[]
  carol: AuthenticatedApiClient
}

export type AssertDistancesResult = { views: PlayerView[] }

export async function assertPublicState({
  homes,
  target,
  stage,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
  views,
  stagingResolutions,
  stagedAliceJourneyId,
  stagedCarolJourneyId,
}: AssertPublicStateInput): Promise<AssertPublicStateResult> {
  for (const expectedJourneyStates of [
    [
      { moving: true, originPlanetId: required(homes[0]).id, distanceToEnd: expect.closeTo(0.679420165502142, 12) },
      { moving: true, originPlanetId: required(homes[2]).id, distanceToEnd: expect.closeTo(7.277541605730438, 12) },
    ],
    [
      { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
      { moving: true, originPlanetId: required(homes[2]).id, distanceToEnd: expect.closeTo(2.277541605730438, 12) },
    ],
    [
      { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
      { moving: false, originPlanetId: target.id, distanceToEnd: undefined },
    ],
  ]) {
    stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    stagingResolutions.push(stage.resolved)
    const aliceJourney = required(views[0]).fleets.find(({ id }) => id === stagedAliceJourneyId)
    const carolJourney = required(views[2]).fleets.find(({ id }) => id === stagedCarolJourneyId)
    Assert.isDefined(aliceJourney)
    Assert.isDefined(carolJourney)
    expect([
      {
        moving: aliceJourney.movement !== undefined,
        originPlanetId: aliceJourney.originPlanetId,
        distanceToEnd: aliceJourney.distanceToEnd,
      },
      {
        moving: carolJourney.movement !== undefined,
        originPlanetId: carolJourney.originPlanetId,
        distanceToEnd: carolJourney.distanceToEnd,
      },
    ]).toStrictEqual(expectedJourneyStates)
  }

  return { stage, views }
}

export type AssertPublicStateInput = {
  homes: Planet[]
  target: Planet
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  views: PlayerView[]
  stagingResolutions: ResolvedTurnState[]
  stagedAliceJourneyId: FleetId
  stagedCarolJourneyId: FleetId
}

export type AssertPublicStateResult = { stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>; views: PlayerView[] }

export function assertPersistedNextRngState(input: AssertPersistedNextRngStateInput): void {
  const persistedNextRngState = { generatorState: input.savedNextTurn.rngGeneratorState, spareNormal: input.savedNextTurn.rngSpareNormal }
  expect(persistedNextRngState).toStrictEqual(input.finalTurnInput.rngState)
  logReceipt("[C3-08 public Assault receipt]", {
    gameId: input.gameId,
    seed: 1,
    target: { id: input.target.id, name: input.target.name, coordinates: input.target.coordinates, x: input.target.x, y: input.target.y },
    homes: input.homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y })),
    distances: input.distances,
    stagedForces: [35, 70, 48],
    stagedArrivalTicks: { alice: 3, carol: 10 },
    bobJourneyDistanceBeforeFinalTurn: input.bobJourney.distanceToEnd,
    positiveTickArrival: input.assertPersistedNextRngStatePhase12Value1.fleets[input.bobJourney.id]?.arrivedAtTick,
    loadedRngState: input.finalTurnInput.rngState,
    replayNextRngState: input.finalReplay.nextRngState,
    persistedNextRngState,
    replaySurvivors: input.ownerByFleet,
    persistedOwner: getPlanets(required(input.views[0])).find(({ id }) => id === input.target.id)?.ownerPlayerId,
    persistedForces: input.views.map((view, index) => {
      const ownerPlayerId = required(input.homeIdsByPlayer[index])
      const fleet = findPublicFleet(view.fleets, { ownerPlayerId, originPlanetId: input.target.id, stationary: true })
      return { playerId: ownerPlayerId, strength: fleet?.strength }
    }),
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
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  gameId: GameId
  target: Planet
  homes: Planet[]
  distances: number[]
  bobJourney: Fleet
  assertPersistedNextRngStatePhase12Value1: ResolvedTurnState
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  ownerByFleet: Array<{ ownerPlayerId: undefined | PlayerId; strength: undefined | NonNegativeSafeInteger }>
  views: PlayerView[]
  homeIdsByPlayer: PlayerId[]
}
