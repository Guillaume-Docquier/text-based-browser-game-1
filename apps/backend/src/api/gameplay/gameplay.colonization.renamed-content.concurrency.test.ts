import { type Success, Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import { describe, expect, it } from "vitest"
import type { Planet, Fleet, PlayerView } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  processTurnWithReplay as CapturedprocessTurnWithReplay,
  replayWorkerInputWithState,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import type { createPublicTwoPlayerFixture as CapturedcreatePublicTwoPlayerFixture } from "#tests/colonization/gameplay.colonization.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  createBobDistanceSetup as CapturedcreateBobDistanceSetup,
  createAliceSetup as CapturedcreateAliceSetup,
  createViewsSetup as CapturedcreateViewsSetup,
  createOrdinaryActionIdSetup as CapturedcreateOrdinaryActionIdSetup,
} from "#tests/fleet-assertions/gameplay.colonization.renamed-content.stages.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import { getFleetAt, processTurnWithReplay } from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  DeadEarlierAttackColonize,
  required,
  findPublicFleet,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  createBobJourneyIdSetup,
  createUpdatedVerifyLaterReplaySetup,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.stages-2.ts"
import {
  createAliceSetup,
  createBobDistanceSetup,
  createAliceColonizeActionIdSetup,
  createViewsSetup,
  createOrdinaryActionIdSetup,
  createPersistedFriendlyFleetsSetup,
  createClientsSetup,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.stages.ts"
import {
  assertPersistedNextRngState,
  assertPersistedNextRngState2,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.ts"

describe("public Colonization worker companions", () => {
  it("should publicly prevent a dead earlier claimant and let the arriving Assault colonize", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()

    // Act & Assert
    const aliceSetup1 = await createAliceSetup({ server })

    const bobSetup1 = await createBobSetup({ aliceSetup1, server })
    const { bob, clients, gameId, clock, turnProcessor, turnsRepository, target, bobDistanceSetup2, bobSource } = bobSetup1
    let { views, stage } = bobSetup1
    const stagedAlice = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    expect(bobSource.strength).toBe(70)

    const bobAttackColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: DeadEarlierAttackColonize.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 70 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobAttackColonizeActionId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.distanceToEnd).toBeCloseTo(3.116999448433268, 12)
    for (const expectedDistance of [2.116999448433268, 1.116999448433268, 0.116999448433268]) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      expect(required(views[1]).fleets.find(({ id }) => id === bobJourney.id)?.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }

    const aliceColonizeActionIdSetup3 = await createAliceColonizeActionIdSetup({
      ...aliceSetup1,
      views,
      stagedAlice,
      bobJourney,
      server,
      bobAttackColonizeActionId,
    })
    const { finalTurn, finalReplay, updatedVerifyFinalReplay } = aliceColonizeActionIdSetup3
    views = updatedVerifyFinalReplay.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === finalTurn.turn + 1)
    Assert.isDefined(savedNextTurn)

    Assert.isSuccess(finalReplay.resolved)

    assertPersistedNextRngStateValue1({
      ...aliceSetup1,
      ...bobDistanceSetup2,
      ...aliceColonizeActionIdSetup3,
      savedNextTurn,
      stagedAlice,
      bobJourney,
      views,
    })
  })

  it("should preserve arrival provenance while public ordinary and colonization arrivals merge", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture

    // Act & Assert
    const viewsScenario2 = await prepareViewsScenario({
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
      server,
    })
    const { stagingFleet, bobStageActionId } = viewsScenario2
    let { views, stage } = viewsScenario2
    const stagedFriendlyArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: required(views[0]).player.id,
      originPlanetId: target.id,
      strength: 10,
    })
    Assert.isDefined(stagedFriendlyArrival)
    expect(stagedFriendlyArrival.arrivedAtTick).toBe(6)
    expect(stage.resolved.removedFleetIds).toContain(stagingFleet.id)
    const bobJourney = required(views[1]).fleets.find(({ movement }) => movement?.submission.id === bobStageActionId)
    Assert.isDefined(bobJourney)
    const bobJourneyId = bobJourney.id
    expect(bobJourney.distanceToEnd).toBeCloseTo(15.111265402761585, 12)
    const stagedFriendly = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 10)
    expect(stagedFriendly.id).toBe(stagedFriendlyArrival.id)

    const bobStagingDistances = [10.111265402761585, 5.111265402761585, 0.111265402761585]
    for (const expectedDistance of bobStagingDistances) {
      stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
      views = stage.views
      const currentJourney = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
      Assert.isDefined(currentJourney)
      expect(currentJourney.distanceToEnd).toBeCloseTo(expectedDistance, 12)
    }
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views

    const ordinaryActionIdScenario3 = await prepareOrdinaryActionIdScenario({
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
    })

    const updatedVerifyFinalReplaySetup4 = await createUpdatedVerifyFinalReplaySetup({
      ...viewsScenario2,
      ...ordinaryActionIdScenario3,
      stagedFriendly,
      target,
      turnProcessor,
      views,
      clients,
      gameId,
      homeA,
      server,
    })
    const { updatedVerifyFinalReplay } = updatedVerifyFinalReplaySetup4
    views = updatedVerifyFinalReplay.views
  })

  it("should let the earlier speed-2 claimant beat a later speed-1 arrival on the next Turn", async () => {
    expect.hasAssertions()

    // Arrange
    await using server = await ConcurrencyTestApiServer.create()

    // Act & Assert
    const clientsSetup7 = await createClientsSetup({ server })
    const { clients, gameId } = clientsSetup7
    let { views } = clientsSetup7

    const bobJourneyIdSetup8 = await createBobJourneyIdSetup({ ...clientsSetup7, server })

    views = await readViews(clients, gameId)

    const updatedVerifyLaterReplaySetup9 = await createUpdatedVerifyLaterReplaySetup({
      ...clientsSetup7,
      ...bobJourneyIdSetup8,
      views,
      server,
    })
    const { updatedVerifyLaterReplay } = updatedVerifyLaterReplaySetup9
    views = updatedVerifyLaterReplay.views
  })
})

function assertPersistedNextRngStateValue1(input: AssertPersistedNextRngStateValue1Input): void {
  Assert.isSuccess(input.finalReplay.resolved)
  const assertPersistedNextRngStatePhase2Value1 = input.finalReplay.resolved.value

  assertPersistedNextRngState({ ...input, assertPersistedNextRngStatePhase2Value1 })
}

async function verifyFinalReplay({
  finalReplay,
  finalTurnInput,
  turnProcessor,
  views,
  clients,
  gameId,
  ordinaryActionIdSetup5,
  target,
  stagedFriendly,
  homeA,
  server,
  bobStageActionId,
  aliceStageActionId,
}: VerifyFinalReplayInput): Promise<VerifyFinalReplayResult> {
  expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
  views = await readViews(clients, gameId)

  const persistedFriendlyFleetsSetup6 = await createPersistedFriendlyFleetsSetup({
    ...ordinaryActionIdSetup5,
    views,
    target,
    stagedFriendly,
    homeA,
    server,
    gameId,
  })

  assertPersistedNextRngState2({
    ...persistedFriendlyFleetsSetup6,
    finalTurnInput,
    gameId,
    views,
    homeA,
    target,
    stagedFriendly,
    finalReplay,
    bobStageActionId,
    aliceStageActionId,
  })

  return { views }
}

type AssertPersistedNextRngStateValue1Input = {
  finalReplay: ReturnType<typeof replayWorkerInputWithState>
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
  gameId: GameId
  target: Planet
  aliceDistance: number
  bobDistance: number
  stagedAlice: Fleet
  bobJourney: Fleet
  bobContinuation: ResolvedTurnState["resolvedContinuations"][number]
  aliceColonizeActionId: string
  bob: AuthenticatedApiClient
  finalWorkerInput: ReturnType<typeof reverseWorkerInputEnumeration>
  views: PlayerView[]
}

type VerifyFinalReplayInput = {
  finalReplay: ReturnType<typeof replayWorkerInputWithState>
  finalTurnInput: ReturnType<typeof reverseWorkerInputEnumeration>
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  ordinaryActionIdSetup5: Awaited<ReturnType<typeof CapturedcreateOrdinaryActionIdSetup>>
  target: Planet
  stagedFriendly: Fleet
  homeA: Planet
  server: ConcurrencyTestApiServer
  bobStageActionId: string
  aliceStageActionId: string
}

type VerifyFinalReplayResult = { views: PlayerView[] }

async function createBobSetup(input: CreateBobSetupInput): Promise<CreateBobSetupResult> {
  const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, aliceHome, bobHome, target } = input.aliceSetup1
  let { views } = input.aliceSetup1

  const bobDistanceSetup2 = await createBobDistanceSetup({ ...input.aliceSetup1, server: input.server })

  let { stage } = bobDistanceSetup2
  views = stage.views
  const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, aliceHome.id, 35)
  const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, bobHome.id, 70)

  const aliceMoveActionId = await submitAction({
    client: alice.client,
    gameId,
    view: required(views[0]),
    actionDefinitionId: MoveFleetExceptional.id,
    selectedTargets: { fleet: aliceSource.id, planet: target.id },
    selectedInputs: { strength: 35 },
  })
  stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceMoveActionId)
  Assert.isDefined(aliceJourney)
  expect(aliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
  stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  expect(required(views[0]).fleets.find(({ id }) => id === aliceJourney.id)?.distanceToEnd).toBeCloseTo(0.679420165502142, 12)
  stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views
  expect(stage.resolved.fleets[aliceJourney.id]?.arrivedAtTick).toBe(3)
  return {
    bob,
    clients,
    gameId,
    clock,
    turnProcessor,
    turnsRepository,
    target,
    views,
    bobDistanceSetup2,
    stage,
    bobSource,
  }
}

async function prepareViewsScenario(input: PrepareViewsScenarioInput): Promise<PrepareViewsScenarioResult> {
  const viewsSetup4 = await createViewsSetup({ ...input })
  const { stagingFleet, bobStageActionId } = viewsSetup4
  let { views } = viewsSetup4
  const stage = await processTurnWithReplay({ ...input, turn: required(views[0]).turn })
  views = stage.views
  return { viewsSetup4, stagingFleet, bobStageActionId, views, stage }
}

async function prepareOrdinaryActionIdScenario(
  input: PrepareOrdinaryActionIdScenarioInput,
): Promise<PrepareOrdinaryActionIdScenarioResult> {
  const ordinaryActionIdSetup5 = await createOrdinaryActionIdSetup({ ...input })
  const { ordinaryActionId, aliceColonizeActionId, bobColonizeActionId, selectedViews, publicReplay, friendlyWinner } =
    ordinaryActionIdSetup5
  return {
    ordinaryActionIdSetup5,
    ordinaryActionId,
    aliceColonizeActionId,
    bobColonizeActionId,
    selectedViews,
    publicReplay,
    friendlyWinner,
  }
}

async function createUpdatedVerifyFinalReplaySetup(
  input: CreateUpdatedVerifyFinalReplaySetupInput,
): Promise<CreateUpdatedVerifyFinalReplaySetupResult> {
  expect(input.friendlyWinner).toMatchObject({
    id: input.stagedFriendly.id,
    name: input.stagedFriendly.name,
    ownerPlayerId: required(input.selectedViews[0]).player.id,
    originPlanetId: input.target.id,
    strength: 40,
    arrivedAtTick: 3,
  })
  const bobWinner = findPublicFleet(Object.values(input.publicReplay.value.fleets), {
    ownerPlayerId: required(input.selectedViews[1]).player.id,
    originPlanetId: input.target.id,
    strength: 15,
  })
  Assert.isDefined(bobWinner)
  expect(bobWinner.arrivedAtTick).toBe(7)
  expect(input.publicReplay.value.planets[input.target.id]?.ownerPlayerId).toBe(required(input.selectedViews[1]).player.id)
  expect(
    input.publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === input.aliceColonizeActionId)
      ?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
  expect(
    input.publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === input.bobColonizeActionId)
      ?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
  expect(
    input.publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === input.ordinaryActionId)?.actionOutcomes,
  ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))

  const updatedVerifyFinalReplay = await verifyFinalReplay({
    ...input,
    ...input.viewsSetup4,
    ...input.ordinaryActionIdSetup5,
    views: input.views,
  })
  return { updatedVerifyFinalReplay }
}

type CreateBobSetupInput = {
  aliceSetup1: Awaited<ReturnType<typeof CapturedcreateAliceSetup>>
  server: ConcurrencyTestApiServer
}

type CreateBobSetupResult = {
  bob: AuthenticatedApiClient
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  clock: ControlledClock
  turnProcessor: TurnProcessor
  turnsRepository: TurnsRepository
  target: Planet
  views: PlayerView[]
  bobDistanceSetup2: Awaited<ReturnType<typeof CapturedcreateBobDistanceSetup>>
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  bobSource: Fleet
}

type PrepareViewsScenarioInput = {
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
  server: ConcurrencyTestApiServer
}

type PrepareViewsScenarioResult = {
  viewsSetup4: Awaited<ReturnType<typeof CapturedcreateViewsSetup>>
  stagingFleet: Fleet
  bobStageActionId: string
  views: PlayerView[]
  stage: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
}

type PrepareOrdinaryActionIdScenarioInput = {
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

type PrepareOrdinaryActionIdScenarioResult = {
  ordinaryActionIdSetup5: Awaited<ReturnType<typeof CapturedcreateOrdinaryActionIdSetup>>
  ordinaryActionId: string
  aliceColonizeActionId: string
  bobColonizeActionId: string
  selectedViews: PlayerView[]
  publicReplay: Success<ResolvedTurnState>
  friendlyWinner: ResolutionFleet
}

type CreateUpdatedVerifyFinalReplaySetupInput = {
  friendlyWinner: ResolutionFleet
  stagedFriendly: Fleet
  selectedViews: PlayerView[]
  target: Planet
  publicReplay: Success<ResolvedTurnState>
  aliceColonizeActionId: string
  bobColonizeActionId: string
  ordinaryActionId: string
  viewsSetup4: Awaited<ReturnType<typeof CapturedcreateViewsSetup>>
  ordinaryActionIdSetup5: Awaited<ReturnType<typeof CapturedcreateOrdinaryActionIdSetup>>
  turnProcessor: TurnProcessor
  views: PlayerView[]
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: number
  homeA: Planet
  server: ConcurrencyTestApiServer
}

type CreateUpdatedVerifyFinalReplaySetupResult = { updatedVerifyFinalReplay: VerifyFinalReplayResult }
