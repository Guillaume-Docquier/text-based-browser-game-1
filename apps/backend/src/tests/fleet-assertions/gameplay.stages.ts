import { type RngState, Assert, branded, Logger, mulberry32Prng, Time, UnitOfTime, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { Planet, SelectedTargets, SelectedInputs, Fleet, PlayerView } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  replayWorkerInput as CapturedreplayWorkerInput,
  reverseWorkerInputEnumeration as CapturedreverseWorkerInputEnumeration,
} from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository, TurnToProcessModel } from "#turn-processing/turns.repository.ts"
import { markManualDeadlineDue, processManualDeadlineTurn } from "../fleet-concurrency/gameplay.scenarios.ts"
import {
  MANUAL_WORKER_TURN_INTERVAL,
  WorkerBuildFleetForty,
  PostgresColonizeWorkerRuleset,
  ColonizePlanetSpeedFive,
  findStationaryFleetAt,
  replayWorkerInput,
  reverseWorkerInputEnumeration,
  expectedTwoPlayerTieWinner,
  findViewForPlayer,
} from "../fleet-concurrency/gameplay.ts"
import { assertUntouchedTarget, assertObservedPreResolutionRngState, assertCapturedInput2 } from "./gameplay.ts"

export async function createClockSetup({ server }: CreateClockSetupInput): Promise<CreateClockSetupResult> {
  const clock = new ControlledClock({ startDate: Clock.now() })
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PostgresColonizeWorkerRuleset))
  const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000001" })
  const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000002" })

  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeWorkerRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(MANUAL_WORKER_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })

  const { createdGameId: untouchedGameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PostgresColonizeWorkerRuleset.id,
      nbSeats: 2,
      turnIntervalSeconds: Time.in(Time.create(30, UnitOfTime.DAYS), UnitOfTime.SECONDS),
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId: untouchedGameId })
  await alice.client.games.startGame.mutate({ gameId: untouchedGameId })

  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
  const clients = [alice, bob] as const
  return { clock, alice, bob, gameId, untouchedGameId, turnProcessor, turnsRepository, clients }
}

export type CreateClockSetupInput = { server: ConcurrencyTestApiServer }

export type CreateClockSetupResult = {
  clock: ControlledClock
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  gameId: GameId
  untouchedGameId: GameId
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

export async function createHomeASetup({
  readViews,
  clients,
  alice,
  untouchedGameId,
  submit,
  processDeadlineTurn,
  gameId,
}: CreateHomeASetupInput): Promise<CreateHomeASetupResult> {
  const initialViews = await readViews()
  const allPlanets = initialViews[0].galaxy.systems.flatMap(({ planets }) => planets)
  const homes = clients.map(({ account }) => allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === branded<PlayerId>(account.id)))
  const homeA = homes[0]
  const homeB = homes[1]
  Assert.isDefined(homeA)
  Assert.isDefined(homeB)
  const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
  Assert.isDefined(target)
  expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
    id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
    name: "planet 907284",
    x: 50.87043629812449,
    y: 48.287412347151275,
  })
  const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
  expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
  expect(target.ownerPlayerId).toBeNull()

  const untouchedInitialView = await alice.client.gameplay.getPlayerView.query({ gameId: untouchedGameId })
  const untouchedTarget = untouchedInitialView.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)
  Assert.isDefined(untouchedTarget)

  await assertUntouchedTarget({
    untouchedTarget,
    untouchedInitialView,
    readViews,
    clients,
    homes,
    submit,
    processDeadlineTurn,
    target,
    gameId,
  })

  const stationedViews = await readViews()
  return { homeA, homeB, target, distances, untouchedInitialView, stationedViews }
}

export type CreateHomeASetupInput = {
  readViews: () => Promise<[PlayerView, PlayerView]>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  alice: AuthenticatedApiClient
  untouchedGameId: GameId
  submit: SubmitCallback
  processDeadlineTurn: (turn: number) => Promise<void>
  gameId: GameId
}

export type CreateHomeASetupResult = {
  homeA: Planet
  homeB: Planet
  target: Planet
  distances: number[]
  untouchedInitialView: PlayerView
  stationedViews: [PlayerView, PlayerView]
}

export async function createObservedPreResolutionRngStateSetup({
  observed,
  alice,
  bob,
  colonizeActionIds,
  target,
  stationedViews,
  stationedFleets,
  turnProcessor,
  gameId,
}: CreateObservedPreResolutionRngStateSetupInput): Promise<CreateObservedPreResolutionRngStateSetupResult> {
  const observedPreResolutionRngState = observed.rngState

  const assertObservedPreResolutionRngStatePhase2Observed = observed

  assertObservedPreResolutionRngState({
    observedPreResolutionRngState,
    alice,
    bob,
    assertObservedPreResolutionRngStatePhase2Observed,
    colonizeActionIds,
    target,
    stationedViews,
    stationedFleets,
  })

  const forwardReplay = replayWorkerInput(observed)
  const reversedReplay = replayWorkerInput(reverseWorkerInputEnumeration(observed))
  // Independently apply the documented two-entry Fisher-Yates draw to the pinned canonical Alice/Bob order.
  const tieOraclePrng = mulberry32Prng(observedPreResolutionRngState.generatorState)
  const firstTieShuffleDraw = tieOraclePrng.next()
  const expectedOwner = expectedTwoPlayerTieWinner(firstTieShuffleDraw, alice.account.id, bob.account.id)
  const expectedNextRngState = {
    generatorState: tieOraclePrng.getState(),
    spareNormal: observedPreResolutionRngState.spareNormal,
  }
  expect(forwardReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(expectedOwner)
  expect(forwardReplay.rngState).toStrictEqual(expectedNextRngState)
  expect(reversedReplay.resolved.planets[target.id]?.ownerPlayerId).toBe(forwardReplay.resolved.planets[target.id]?.ownerPlayerId)
  expect(reversedReplay.actionOutcomes).toStrictEqual(forwardReplay.actionOutcomes)
  expect(reversedReplay.rngState).toStrictEqual(forwardReplay.rngState)
  expect(forwardReplay.resolved.planetOwnershipChanges).toHaveLength(1)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  const aliceAfter = await alice.client.gameplay.getPlayerView.query({ gameId })
  const bobAfter = await bob.client.gameplay.getPlayerView.query({ gameId })
  const replayOwner = forwardReplay.resolved.planets[target.id]?.ownerPlayerId
  Assert.isDefined(replayOwner)
  expect(replayOwner).toBe(expectedOwner)
  const persistedOwner = aliceAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId
  expect(persistedOwner).toBe(expectedOwner)
  expect(bobAfter.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(expectedOwner)
  const alicePlayerId = branded<PlayerId>(alice.account.id)
  const bobPlayerId = branded<PlayerId>(bob.account.id)
  const finalViews = [aliceAfter, bobAfter]
  const aliceFinalView = findViewForPlayer(finalViews, alicePlayerId)
  const bobFinalView = findViewForPlayer(finalViews, bobPlayerId)
  Assert.isDefined(aliceFinalView)
  Assert.isDefined(bobFinalView)
  const aliceSurvivor = findStationaryFleetAt(aliceFinalView, alicePlayerId, target.id)
  const bobSurvivor = findStationaryFleetAt(bobFinalView, bobPlayerId, target.id)
  Assert.isDefined(aliceSurvivor)
  Assert.isDefined(bobSurvivor)
  return {
    observedPreResolutionRngState,
    forwardReplay,
    firstTieShuffleDraw,
    expectedOwner,
    expectedNextRngState,
    aliceAfter,
    bobAfter,
    persistedOwner,
    alicePlayerId,
    bobPlayerId,
    aliceSurvivor,
    bobSurvivor,
  }
}

export type CreateObservedPreResolutionRngStateSetupInput = {
  observed: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  colonizeActionIds: string[]
  target: Planet
  stationedViews: [PlayerView, PlayerView]
  stationedFleets: Array<undefined | Fleet>
  turnProcessor: TurnProcessor
  gameId: GameId
}

export type CreateObservedPreResolutionRngStateSetupResult = {
  observedPreResolutionRngState: RngState<number>
  forwardReplay: ReturnType<typeof CapturedreplayWorkerInput>
  firstTieShuffleDraw: number
  expectedOwner: PlayerId
  expectedNextRngState: { generatorState: number; spareNormal: null | number }
  aliceAfter: PlayerView
  bobAfter: PlayerView
  persistedOwner: undefined | null | PlayerId
  alicePlayerId: PlayerId
  bobPlayerId: PlayerId
  aliceSurvivor: Fleet
  bobSurvivor: Fleet
}

export async function createViewsSetup({
  readViews,
  alice,
  bob,
  submitAction,
  buildActionDefinitionId,
  clock,
  turnProcessor,
  turnsRepository,
  gameId,
  builtStrength,
  findPlanetOwner,
}: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = await readViews()
  const allPlanets = views[0].galaxy.systems.flatMap(({ planets }) => planets)
  const alicePlayerId = branded<PlayerId>(alice.account.id)
  const bobPlayerId = branded<PlayerId>(bob.account.id)
  const homeA = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === alicePlayerId)
  const homeB = allPlanets.find(({ ownerPlayerId }) => ownerPlayerId === bobPlayerId)
  const target = allPlanets.find(({ coordinates }) => coordinates === "45:80:45")
  Assert.isDefined(homeA)
  Assert.isDefined(homeB)
  Assert.isDefined(target)
  expect([homeA.coordinates, homeB.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
  expect({ id: target.id, name: target.name, x: target.x, y: target.y }).toStrictEqual({
    id: "80784487-ba71-54b9-b7c6-32ca91390a9d",
    name: "planet 907284",
    x: 50.87043629812449,
    y: 48.287412347151275,
  })
  const distances = [homeA, homeB].map((home) => Math.hypot(home.x - target.x, home.y - target.y))
  expect(distances).toStrictEqual([2.404059226669645, 2.4665348802971394])
  expect(target.ownerPlayerId).toBeNull()
  for (const view of views) {
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
  }

  const aliceInitialView = views[0]
  const bobInitialView = views[1]
  const buildTurn = aliceInitialView.turn
  await submitAction(alice.client, aliceInitialView, WorkerBuildFleetForty.id, { planet: homeA.id }, {})
  await submitAction(bob.client, bobInitialView, buildActionDefinitionId, { planet: homeB.id }, {})
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: buildTurn })
  views = await readViews()
  const aliceBuild = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
  const bobBuild = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
  Assert.isDefined(aliceBuild)
  Assert.isDefined(bobBuild)
  expect(aliceBuild.strength).toBe(40)
  expect(bobBuild.strength).toBe(builtStrength)
  expect(findPlanetOwner(views[0], target.id)).toBeNull()

  const stageTurn = views[0].turn
  await submitAction(alice.client, views[0], MoveFleetExceptional.id, { fleet: aliceBuild.id, planet: target.id }, { strength: 35 })
  await processManualDeadlineTurn({ clock, turnProcessor, turnsRepository, client: alice.client, gameId, turn: stageTurn })
  views = await readViews()
  const stagedAlice = findStationaryFleetAt(views[0], alicePlayerId, target.id)
  const stagedAliceHomeRemainder = findStationaryFleetAt(views[0], alicePlayerId, homeA.id)
  const stagedBob = findStationaryFleetAt(views[1], bobPlayerId, homeB.id)
  Assert.isDefined(stagedAlice)
  Assert.isDefined(stagedAliceHomeRemainder)
  Assert.isDefined(stagedBob)
  return { views, alicePlayerId, bobPlayerId, homeA, homeB, target, distances, stagedAlice, stagedAliceHomeRemainder, stagedBob }
}

export type CreateViewsSetupInput = {
  readViews: () => Promise<[PlayerView, PlayerView]>
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  submitAction: SubmitCallback
  buildActionDefinitionId: ActionDefinitionId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  gameId: GameId
  builtStrength: 40 | 70
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
}

export type CreateViewsSetupResult = {
  views: [PlayerView, PlayerView]
  alicePlayerId: PlayerId
  bobPlayerId: PlayerId
  homeA: Planet
  homeB: Planet
  target: Planet
  distances: number[]
  stagedAlice: Fleet
  stagedAliceHomeRemainder: Fleet
  stagedBob: Fleet
}

export async function createPriorityTurnSetup({
  stagedAlice,
  stagedAliceHomeRemainder,
  stagedBob,
  builtStrength,
  findPlanetOwner,
  views,
  target,
  submitAction,
  alice,
  bob,
  movingStrength,
  readViews,
  clock,
  turnsRepository,
  gameId,
}: CreatePriorityTurnSetupInput): Promise<CreatePriorityTurnSetupResult> {
  expect(stagedAlice.strength).toBe(35)
  expect(stagedAliceHomeRemainder.strength).toBe(5)
  expect(stagedBob.strength).toBe(builtStrength)
  expect(findPlanetOwner(views[0], target.id)).toBeNull()

  // Act & Assert
  const priorityTurn = views[0].turn
  const aliceColonizeActionId = await submitAction(
    alice.client,
    views[0],
    ColonizeHereTest.id,
    { fleet: stagedAlice.id, planet: target.id },
    {},
  )
  const bobColonizeActionId = await submitAction(
    bob.client,
    views[1],
    ColonizePlanetSpeedFive.id,
    { fleet: stagedBob.id, planet: target.id },
    { strength: movingStrength },
  )
  const selectedViews = await readViews()
  expect(selectedViews.map(({ resources }) => resources[ResourceType.INFLUENCE])).toStrictEqual([
    { total: 95, uncommitted: 70 },
    { total: 98, uncommitted: 73 },
  ])
  expect(selectedViews.map(({ resources }) => resources[ResourceType.COLONY])).toStrictEqual([
    { total: 0, uncommitted: 0 },
    { total: 0, uncommitted: 0 },
  ])
  expect(findPlanetOwner(selectedViews[0], target.id)).toBeNull()

  await markManualDeadlineDue({ clock, turnsRepository })
  const observed: TurnToProcessModel | undefined = undefined
  const rollbackMessage = "Intentional C3-07 worker input observation rollback for game " + gameId
  return { priorityTurn, aliceColonizeActionId, bobColonizeActionId, observed, rollbackMessage }
}

export type CreatePriorityTurnSetupInput = {
  stagedAlice: Fleet
  stagedAliceHomeRemainder: Fleet
  stagedBob: Fleet
  builtStrength: 40 | 70
  findPlanetOwner: (view: PlayerView, planetId: PlanetId) => undefined | null | PlayerId
  views: [PlayerView, PlayerView]
  target: Planet
  submitAction: SubmitCallback
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  movingStrength: 35 | 70
  readViews: () => Promise<[PlayerView, PlayerView]>
  clock: ControlledClock
  turnsRepository: TurnsRepository
  gameId: GameId
}

export type CreatePriorityTurnSetupResult = {
  priorityTurn: number
  aliceColonizeActionId: string
  bobColonizeActionId: string
  observed: undefined | ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  rollbackMessage: string
}

export async function createCapturedInputSetup({
  observed,
  target,
  alicePlayerId,
  bobPlayerId,
  stagedAlice,
  stagedBob,
  homeB,
  builtStrength,
  aliceColonizeActionId,
  bobColonizeActionId,
  movingStrength,
  turnProcessor,
}: CreateCapturedInputSetupInput): Promise<CreateCapturedInputSetupResult> {
  const capturedInput = observed

  const assertAssertCapturedInputState1Phase4CapturedInput = capturedInput

  assertCapturedInput2({
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
  })

  const replay = replayWorkerInput(capturedInput)
  expect(replay.resolved.planets[target.id]?.ownerPlayerId).toBe(alicePlayerId)
  expect(replay.resolved.fleets[stagedAlice.id]).toMatchObject({
    ownerPlayerId: alicePlayerId,
    originPlanetId: target.id,
    strength: 15,
  })
  const bobArrivals = Object.values(replay.resolved.fleets).filter(({ strength }) => strength === movingStrength)
  expect(bobArrivals).toHaveLength(1)
  const bobArrival = bobArrivals[0]
  Assert.isDefined(bobArrival)
  expect(bobArrival).toMatchObject({
    ownerPlayerId: bobPlayerId,
    originPlanetId: target.id,
    strength: movingStrength,
    arrivedAtTick: 10,
  })
  expect(bobArrival.movement).toBeUndefined()
  const replayAliceOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === aliceColonizeActionId)
  const replayBobOutcomes = replay.actionOutcomes.find(({ actionId }) => actionId === bobColonizeActionId)
  Assert.isDefined(replayAliceOutcomes)
  Assert.isDefined(replayBobOutcomes)
  expect(replayAliceOutcomes.outcomes).toContainEqual(
    expect.objectContaining({ type: "RESOLVED", result: expect.stringContaining("colonized Planet") }),
  )
  expect(replayBobOutcomes.outcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED", reason: "Planet is already claimed" }))
  expect(replay.rngState).toStrictEqual(capturedInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  return { capturedInput, replay, bobArrival }
}

export type CreateCapturedInputSetupInput = {
  observed: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  target: Planet
  alicePlayerId: PlayerId
  bobPlayerId: PlayerId
  stagedAlice: Fleet
  stagedBob: Fleet
  homeB: Planet
  builtStrength: 40 | 70
  aliceColonizeActionId: string
  bobColonizeActionId: string
  movingStrength: 35 | 70
  turnProcessor: TurnProcessor
}

export type CreateCapturedInputSetupResult = {
  capturedInput: ReturnType<typeof CapturedreverseWorkerInputEnumeration>
  replay: ReturnType<typeof CapturedreplayWorkerInput>
  bobArrival: ResolutionFleet
}

type SubmitCallback = (
  client: AuthenticatedApiClient["client"],
  view: PlayerView,
  actionDefinitionId: ActionDefinitionId,
  selectedTargets: DeepUnbranded<SelectedTargets>,
  selectedInputs: DeepUnbranded<SelectedInputs>,
) => Promise<string>
