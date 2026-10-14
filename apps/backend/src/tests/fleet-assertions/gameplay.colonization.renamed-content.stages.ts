import { type Success, Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { expect } from "vitest"
import type { PlayerView, Planet, Fleet } from "#api/types.ts"
import { Clock } from "#lib/Clock.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  processTurnWithReplay as CapturedprocessTurnWithReplay,
  replayWorkerInputWithState as CapturedreplayWorkerInputWithState,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicTwoPlayerFixture as CapturedcreatePublicTwoPlayerFixture } from "#tests/colonization/gameplay.colonization.ts"
import type { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type { AssertFinalReplayResult } from "#tests/fleet-assertions/gameplay.colonization.renamed-content.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  stagePublicMergeScenario,
  getPlanets,
  getHome,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInputWithState,
} from "../colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  BuildFleet10ForStaging,
  BuildFleet35,
  BuildFleet50,
  BuildFleet70,
  MoveFleetSpeed10,
  ColonizeFleetSpeed2,
  ColonizeFleetSpeed4,
  PublicColonizationFixtureRuleset,
  required,
  playerIdFor,
  matchesPublicFleet,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../colonization/gameplay.colonization.ts"
import { assertFinalReplay } from "./gameplay.colonization.renamed-content.ts"

export async function createAliceSetup({ server }: CreateAliceSetupInput): Promise<CreateAliceSetupResult> {
  const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
  Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
  const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000031" })
  const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000032" })
  const carol = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000033" })
  const clients = [alice, bob, carol] as const
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: PublicColonizationFixtureRuleset.id,
      nbSeats: 3,
      turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
      mapGenerationSeed: 1,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await carol.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  const clock = new ControlledClock({ startDate: Clock.now() })
  const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

  const views = await readViews(clients, gameId)
  const aliceHome = getHome(required(views[0]))
  const bobHome = getHome(required(views[1]))
  const target = getPlanets(required(views[0])).find(({ id }) => id === "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b")
  Assert.isDefined(target)
  expect({ id: aliceHome.id, name: aliceHome.name, coordinates: aliceHome.coordinates }).toStrictEqual({
    id: "2e5272ce-7a3a-545c-ab41-a924ca3bb5b5",
    name: "planet 624762",
    coordinates: "55:19:35",
  })
  expect({ id: bobHome.id, name: bobHome.name, coordinates: bobHome.coordinates }).toStrictEqual({
    id: "7262a26b-70f2-5f0b-8996-55211b146f71",
    name: "planet 483980",
    coordinates: "54:86:30",
  })
  expect({ id: target.id, name: target.name, coordinates: target.coordinates }).toStrictEqual({
    id: "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b",
    name: "planet 457985",
    coordinates: "54:59:10",
  })
  const aliceDistance = Math.hypot(aliceHome.x - target.x, aliceHome.y - target.y)
  return { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, views, aliceHome, bobHome, target, aliceDistance }
}

export type CreateAliceSetupInput = { server: ConcurrencyTestApiServer }

export type CreateAliceSetupResult = {
  alice: AuthenticatedApiClient
  bob: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  views: PlayerView[]
  aliceHome: Planet
  bobHome: Planet
  target: Planet
  aliceDistance: number
}

export async function createBobDistanceSetup({
  bobHome,
  target,
  aliceDistance,
  alice,
  gameId,
  views,
  aliceHome,
  bob,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
}: CreateBobDistanceSetupInput): Promise<CreateBobDistanceSetupResult> {
  const bobDistance = Math.hypot(bobHome.x - target.x, bobHome.y - target.y)
  expect(aliceDistance).toBeCloseTo(10.679420165502142, 12)
  expect(bobDistance).toBeCloseTo(4.116999448433268, 12)
  expect(target.ownerPlayerId).toBeNull()

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: aliceHome.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet70.id,
    selectedTargets: { planet: bobHome.id },
    selectedInputs: {},
  })
  const stage = await processTurnWithReplay({
    server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  return { bobDistance, stage }
}

export type CreateBobDistanceSetupInput = {
  bobHome: Planet
  target: Planet
  aliceDistance: number
  alice: AuthenticatedApiClient
  gameId: GameId
  views: PlayerView[]
  aliceHome: Planet
  bob: AuthenticatedApiClient
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
}

export type CreateBobDistanceSetupResult = { bobDistance: number; stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>> }

export async function createAliceColonizeActionIdSetup({
  views,
  stagedAlice,
  bobJourney,
  alice,
  gameId,
  target,
  server,
  clock,
  turnsRepository,
  bob,
  bobAttackColonizeActionId,
  turnProcessor,
  clients,
}: CreateAliceColonizeActionIdSetupInput): Promise<CreateAliceColonizeActionIdSetupResult> {
  expect(required(views[0]).fleets.find(({ id }) => id === stagedAlice.id)?.strength).toBe(35)
  expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.movement).toBeDefined()

  const aliceColonizeActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeHereTest.id,
    selectedTargets: { fleet: stagedAlice.id, planet: target.id },
    selectedInputs: {},
  })
  const finalTurn = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(finalTurn.actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({ isInProgress: false })
  expect(finalTurn.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

  const finalWorkerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: finalTurn.turn })
  const finalReplay = replayWorkerInputWithState(finalWorkerInput)
  Assert.isSuccess(finalReplay.resolved)
  expect(finalWorkerInput.planets[target.id]?.ownerPlayerId).toBeNull()
  expect(finalWorkerInput.fleets[stagedAlice.id]?.strength).toBe(35)
  expect(finalWorkerInput.fleets[bobJourney.id]?.strength).toBe(70)
  expect(finalWorkerInput.fleets[bobJourney.id]?.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
  Assert.isSuccess(finalReplay.resolved)
  expect(finalReplay.resolved.value.fleets[stagedAlice.id]).toBeUndefined()
  Assert.isSuccess(finalReplay.resolved)
  expect(finalReplay.resolved.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
  Assert.isSuccess(finalReplay.resolved)
  expect(finalReplay.resolved.value.fleets[bobJourney.id]?.strength).toBe(15)
  Assert.isSuccess(finalReplay.resolved)
  expect(finalReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(bob))
  Assert.isSuccess(finalReplay.resolved)
  expect(
    finalReplay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
  Assert.isSuccess(finalReplay.resolved)
  const bobContinuation = finalReplay.resolved.value.resolvedContinuations.find(
    ({ originatingSubmission }) => originatingSubmission.id === bobAttackColonizeActionId,
  )
  Assert.isDefined(bobContinuation)

  const updatedVerifyFinalReplay = await assertFinalReplay({
    bobContinuation,
    finalReplay,
    finalWorkerInput,
    turnProcessor,
    views,
    clients,
    gameId,
    target,
    bob,
    stagedAlice,
  })
  return { aliceColonizeActionId, finalTurn, finalWorkerInput, finalReplay, bobContinuation, updatedVerifyFinalReplay }
}

export type CreateAliceColonizeActionIdSetupInput = {
  views: PlayerView[]
  stagedAlice: Fleet
  bobJourney: Fleet
  alice: AuthenticatedApiClient
  gameId: GameId
  target: Planet
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  bob: AuthenticatedApiClient
  bobAttackColonizeActionId: string
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
}

export type CreateAliceColonizeActionIdSetupResult = {
  aliceColonizeActionId: string
  finalTurn: PlayerView
  finalWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  updatedVerifyFinalReplay: AssertFinalReplayResult
}

export async function createViewsSetup({
  fixture,
  target,
  alice,
  gameId,
  homeA,
  bob,
  homeB,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
}: CreateViewsSetupInput): Promise<CreateViewsSetupResult> {
  let views = fixture.views
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet10ForStaging.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: BuildFleet35.id,
    selectedTargets: { planet: homeB.id },
    selectedInputs: {},
  })
  await processTurn({ clock, turnsRepository, turnProcessor, client: alice.client, gameId, turn: required(views[0]).turn })
  views = await readViews(clients, gameId)
  const stagingFleet = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 10)
  const bobSourceFleet = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 35)

  const aliceStageActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: stagingFleet.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: BuildFleet50.id,
    selectedTargets: { planet: homeA.id },
    selectedInputs: {},
  })
  const bobStageActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: bobSourceFleet.id, planet: homeA.id },
    selectedInputs: { strength: 35 },
  })
  return { views, stagingFleet, aliceStageActionId, bobStageActionId }
}

export type CreateViewsSetupInput = {
  fixture: Awaited<ReturnType<typeof CapturedcreatePublicTwoPlayerFixture>>
  target: Planet
  alice: AuthenticatedApiClient
  gameId: number
  homeA: Planet
  bob: AuthenticatedApiClient
  homeB: Planet
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
}

export type CreateViewsSetupResult = { views: PlayerView[]; stagingFleet: Fleet; aliceStageActionId: string; bobStageActionId: string }

export async function createOrdinaryActionIdSetup({
  stage,
  bobJourneyId,
  views,
  homeA,
  target,
  stagedFriendly,
  alice,
  gameId,
  bob,
  clients,
  server,
  clock,
  turnsRepository,
}: CreateOrdinaryActionIdSetupInput): Promise<CreateOrdinaryActionIdSetupResult> {
  expect(stage.resolved.fleets[bobJourneyId]?.arrivedAtTick).toBe(1)
  const bobAtSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeA.id, 35)
  expect(bobAtSource.id).toBe(bobJourneyId)

  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 50)
  const stagedAtDestination = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
  expect(stagedAtDestination.id).toBe(stagedFriendly.id)
  const ordinaryActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  const aliceColonizeActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed2.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 20 },
  })
  const bobColonizeActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: ColonizeFleetSpeed4.id,
    selectedTargets: { fleet: bobAtSource.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  const selectedViews = await readViews(clients, gameId)
  expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
  expect(required(selectedViews[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 90 })
  expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })
  expect(required(selectedViews[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(getFleetAt(required(selectedViews[0]), required(selectedViews[0]).player.id, homeA.id, 50).id).toBe(aliceSource.id)

  const finalTurnInput = await captureWorkerInput({
    server,
    clock,
    turnsRepository,
    gameId,
    turn: required(selectedViews[0]).turn,
  })
  const finalReplay = replayWorkerInputWithState(finalTurnInput)
  const publicReplay = finalReplay.resolved
  Assert.isSuccess(publicReplay)
  const friendlyWinner = publicReplay.value.fleets[stagedFriendly.id]
  Assert.isDefined(friendlyWinner)
  return {
    ordinaryActionId,
    aliceColonizeActionId,
    bobColonizeActionId,
    selectedViews,
    finalTurnInput,
    finalReplay,
    publicReplay,
    friendlyWinner,
  }
}

export type CreateOrdinaryActionIdSetupInput = {
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobJourneyId: FleetId
  views: PlayerView[]
  homeA: Planet
  target: Planet
  stagedFriendly: Fleet
  alice: AuthenticatedApiClient
  gameId: number
  bob: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

export type CreateOrdinaryActionIdSetupResult = {
  ordinaryActionId: string
  aliceColonizeActionId: string
  bobColonizeActionId: string
  selectedViews: PlayerView[]
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  finalReplay: ReturnType<typeof CapturedreplayWorkerInputWithState>
  publicReplay: Success<ResolvedTurnState>
  friendlyWinner: ResolutionFleet
}

export async function createPersistedFriendlyFleetsSetup({
  views,
  target,
  stagedFriendly,
  homeA,
  ordinaryActionId,
  aliceColonizeActionId,
  bobColonizeActionId,
  server,
  gameId,
  selectedViews,
}: CreatePersistedFriendlyFleetsSetupInput): Promise<CreatePersistedFriendlyFleetsSetupResult> {
  expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[1]).player.id)
  const persistedFriendlyFleets = required(views[0]).fleets.filter((fleet) =>
    matchesPublicFleet(fleet, { ownerPlayerId: required(views[0]).player.id, originPlanetId: target.id, stationary: true }),
  )
  expect(persistedFriendlyFleets).toStrictEqual([
    expect.objectContaining({ id: stagedFriendly.id, name: stagedFriendly.name, strength: 40 }),
  ])
  expect(getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 15)).toBeDefined()
  expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)).toBeDefined()
  expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
  expect(required(views[0]).resources[ResourceType.FUEL]).toStrictEqual({ total: 90, uncommitted: 90 })
  expect(required(views[0]).resources[ResourceType.METAL]).toStrictEqual({ total: 98, uncommitted: 98 })
  expect(required(views[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 470, uncommitted: 470 })
  expect(required(views[1]).resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
  expect(required(views[1]).resources[ResourceType.METAL]).toStrictEqual({ total: 99, uncommitted: 99 })
  expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0])
  for (const [view, actionIds] of [
    [required(views[0]), [ordinaryActionId, aliceColonizeActionId]],
    [required(views[1]), [bobColonizeActionId]],
  ] as const) {
    for (const actionId of actionIds) {
      expect(view.actions.find(({ id }) => id === actionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
    }
  }
  const savedTurns = await server.database
    .select()
    .from(turnsTable)
    .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
  const savedNextTurn = savedTurns.find(({ turn }) => turn === required(selectedViews[0]).turn + 1)
  Assert.isDefined(savedNextTurn)
  return { persistedFriendlyFleets, savedNextTurn }
}

export type CreatePersistedFriendlyFleetsSetupInput = {
  views: PlayerView[]
  target: Planet
  stagedFriendly: Fleet
  homeA: Planet
  ordinaryActionId: string
  aliceColonizeActionId: string
  bobColonizeActionId: string
  server: ConcurrencyTestApiServer
  gameId: number
  selectedViews: PlayerView[]
}

export type CreatePersistedFriendlyFleetsSetupResult = {
  persistedFriendlyFleets: Fleet[]
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
}

export async function createClientsSetup({ server }: CreateClientsSetupInput): Promise<CreateClientsSetupResult> {
  const fixture = await createPublicTwoPlayerFixture(server)
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
  const staged = await stagePublicMergeScenario(server, fixture)
  const views = staged.views
  const { stagedFriendly, bobAtSource, aliceSource } = staged

  const ordinaryActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetSpeed10.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 10 },
  })
  const aliceColonizeActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: ColonizeFleetSpeed2.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 20 },
  })
  const bobColonizeActionId = await submitAction({
    client: bob.client,
    gameId,
    view: required(views[1]),
    actionDefinitionId: ColonizePlanetTest.id,
    selectedTargets: { fleet: bobAtSource.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  return {
    clients,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    homeA,
    target,
    views,
    stagedFriendly,
    ordinaryActionId,
    aliceColonizeActionId,
    bobColonizeActionId,
  }
}

export type CreateClientsSetupInput = { server: ConcurrencyTestApiServer }

export type CreateClientsSetupResult = {
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  homeA: Planet
  target: Planet
  views: PlayerView[]
  stagedFriendly: Fleet
  ordinaryActionId: string
  aliceColonizeActionId: string
  bobColonizeActionId: string
}
