import { type Success, Assert } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { type GameId, GameIdSchema } from "shared/domain/games/GameId.ts"
import type { NonNegativeSafeInteger } from "shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { describe, expect, it } from "vitest"
import type { PlayerView, Planet, Fleet } from "#api/types.ts"
import type { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import type {
  processTurnWithReplay as CapturedprocessTurnWithReplay,
  replayWorkerInputWithState,
} from "#tests/colonization/gameplay.colonization.scenarios.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import type {
  createClockSetup as CapturedcreateClockSetup,
  createStagedAliceJourneyIdSetup as CapturedcreateStagedAliceJourneyIdSetup,
} from "#tests/fleet-assertions/gameplay.colonization.stationary.stages.ts"
import type { normalizeApiDate } from "#tests/fleet-concurrency/gameplay.scenarios.ts"
import type { reverseWorkerInputEnumeration } from "#tests/fleet-concurrency/gameplay.ts"
import type { TurnProcessor } from "#turn-processing/TurnProcessor.ts"
import type { TurnsRepository } from "#turn-processing/turns.repository.ts"
import {
  getPlanets,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInput,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  SeedOutpost,
  SeedOutpostHere,
  PublicBudgetStageFleet,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  readViews,
  createPublicNaturalRouteFixture,
  publiclyBuildFleetToFifty,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertDistances, assertPersistedNextRngState } from "../../tests/fleet-assertions/gameplay.colonization.stationary-2.ts"
import { createStagedAliceSetup, createReadyViewsSetup } from "../../tests/fleet-assertions/gameplay.colonization.stationary.stages-2.ts"
import {
  createPlayerSetup,
  createMoveFixtureSetup,
  createMoveDestinationSetup,
  createPlayerSetup2,
  createArrivalSetup,
  createClockSetup,
  createStagedAliceJourneyIdSetup,
} from "../../tests/fleet-assertions/gameplay.colonization.stationary.stages.ts"
import {
  assertReplayedMovedFive,
  assertOutOfRangeDistance,
  assertActualWorkerInput2,
  assertReplayedSeedFleet,
} from "../../tests/fleet-assertions/gameplay.colonization.stationary.ts"

describe("public Colonization worker companions", () => {
  it("should preserve the public natural-route cost and locked intent across reloads", async () => {
    expect.hasAssertions()

    await using server = await ConcurrencyTestApiServer.create()

    const playerSetup1 = await createPlayerSetup({ server })

    const moveFixtureSetup2 = await createMoveFixtureSetup({ ...playerSetup1, server })

    const moveDestinationSetup3 = await createMoveDestinationSetup({ ...moveFixtureSetup2, server })

    await assertReplayedMovedFive({ ...moveFixtureSetup2, ...moveDestinationSetup3 })
  })

  it("should resolve the renamed Seed Outpost content using its public tags and exact costs", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000033")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const { view: builtView, fleet: sourceFleet } = await publiclyBuildFleetToFifty(fixture)
    const seedOutpostAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === SeedOutpost.id)
    Assert.isDefined(seedOutpostAction)
    const outOfRangeTarget = getPlanets(builtView).find(({ id }) => id === "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5")
    Assert.isDefined(outOfRangeTarget)

    await assertOutOfRangeDistance({ outOfRangeTarget, home, player, gameId, builtView, seedOutpostAction, sourceFleet, target })

    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
      actionDefinitionId: SeedOutpost.id,
      selectedTargets: { force: sourceFleet.id, site: target.id },
      selectedInputs: { quota: 45 },
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

    const actualWorkerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: selectedView.turn,
    })

    assertActualWorkerInput2({ actualWorkerInput, seedOutpostAction, sourceFleet, target })

    const alternateReplay = replayWorkerInput(actualWorkerInput)
    Assert.isSuccess(alternateReplay)
    const replayedSeedFleet = findPublicFleet(Object.values(alternateReplay.value.fleets), {
      ownerPlayerId: selectedView.player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(replayedSeedFleet)

    await assertReplayedSeedFleet({
      replayedSeedFleet,
      clock,
      turnsRepository,
      turnProcessor,
      player,
      gameId,
      selectedView,
      target,
      home,
      sourceFleet,
      seedOutpostAction,
      actualWorkerInput,
    })
  })

  it("should claim a stationary public Seed Outpost with exactly30 Strength after worker arrival", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const playerSetup4 = await createPlayerSetup2({ server })
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target, routeDistance } = playerSetup4
    let { view } = playerSetup4
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const homeFleet = getFleetAt(view, view.player.id, home.id, 30)
    const stageAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetStageFleet.id)
    Assert.isDefined(stageAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: stageAction.id,
        selectedTargets: { fleet: homeFleet.id, planet: target.id },
        selectedInputs: { strength: 30 },
      },
    })
    const staged = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients: [player],
      gameId,
      turn: view.turn,
    })
    view = required(staged.views[0])

    const arrivalSetup5 = await createArrivalSetup({ ...playerSetup4, staged, view, server })
    const { arrival, workerInput, replay, updatedAssertFindPlayerAction } = arrivalSetup5
    view = updatedAssertFindPlayerAction.view

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-20 public stationary Seed Outpost exact30 receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      publicSetup: { built: 30, moved: 30, actualArrivalTick: arrival.arrivedAtTick },
      loadedAction: workerInput.ruleset.actionDefinitions[SeedOutpostHere.id],
      result: {
        owner: playerIdFor(player),
        survivingTargetFleetRows: view.fleets.filter(({ originPlanetId }) => originPlanetId === target.id).length,
      },
      payment: { influence: 7, fuel: 2, remaining: { influence: 93, fuel: 8 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })

  it("should let the later surviving public claimant succeed after a third-owner Assault weakens the earlier force", async () => {
    await using server = await ConcurrencyTestApiServer.create()

    const clockScenario1 = await prepareClockScenario({ server })
    const { clockSetup6, clients, gameId, turnProcessor, homeIdsByPlayer, target, stagedAliceJourneyIdSetup7 } = clockScenario1
    let { views } = clockScenario1

    const stagedAliceSetup8 = await createStagedAliceSetup({
      ...clockScenario1,
      ...clockSetup6,
      ...stagedAliceJourneyIdSetup7,
      server,
      views,
    })
    const { stagedAlice, stagedCarol } = stagedAliceSetup8
    let { bobDeparture } = stagedAliceSetup8
    views = bobDeparture.views
    const movingBob = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(homeIdsByPlayer[1]), destinationPlanetId: target.id }),
    )
    Assert.isDefined(movingBob)
    const movingBobId = movingBob.id

    const updatedVerifyMovingBob = await verifyMovingBob({
      ...clockSetup6,
      ...stagedAliceSetup8,
      movingBob,
      server,
      views,
      movingBobId,
    })
    bobDeparture = updatedVerifyMovingBob.bobDeparture
    views = updatedVerifyMovingBob.views

    const readyViewsSetup9 = await createReadyViewsSetup({
      ...clockSetup6,
      ...stagedAliceSetup8,
      views,
      movingBobId,
      server,
    })
    const { readyViews, bobJourney, publicReplay } = readyViewsSetup9
    const ownerByFleet = [stagedAlice.id, stagedCarol.id, bobJourney.id].map((fleetId) => {
      const fleet = publicReplay.value.fleets[fleetId]
      return { ownerPlayerId: fleet?.ownerPlayerId, strength: fleet?.strength }
    })
    expect(ownerByFleet).toContainEqual({ ownerPlayerId: homeIdsByPlayer[0], strength: 19 })
    expect(ownerByFleet).toContainEqual({ ownerPlayerId: homeIdsByPlayer[1], strength: 18 })
    expect(publicReplay.value.fleets[stagedCarol.id]).toBeUndefined()
    expect(publicReplay.value.planets[target.id]?.ownerPlayerId).toBe(homeIdsByPlayer[1])

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(homeIdsByPlayer[1])
    expect(getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), target.id, 19)).toBeDefined()
    expect(getFleetAt(required(views[1]), required(homeIdsByPlayer[1]), target.id, 18)).toBeDefined()
    expect(required(views[2]).fleets.some(({ id }) => id === stagedCarol.id)).toBe(false)
    expect(views.map(({ resources }) => resources[ResourceType.COLONY].total)).toStrictEqual([0, 0, 0])
    expect(views.map(({ resources }) => resources[ResourceType.INFLUENCE].total)).toStrictEqual([470, 473, 495])
    expect(views.map(({ resources }) => resources[ResourceType.METAL].total)).toStrictEqual([99, 99, 99])
    expect(views.map(({ resources }) => resources[ResourceType.FUEL].total)).toStrictEqual([95, 100, 95])
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === required(readyViews[0]).turn + 1)
    Assert.isDefined(savedNextTurn)

    assertPersistedNextRngStateValue1({
      ...clockScenario1,
      ...clockSetup6,
      ...readyViewsSetup9,
      savedNextTurn,
      ownerByFleet,
      views,
    })
  })
})

async function verifyUpdatedVerifyDistances({
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
}: VerifyUpdatedVerifyDistancesInput): Promise<VerifyUpdatedVerifyDistancesResult> {
  const updatedVerifyDistances = await assertDistances({
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
  })
  views = updatedVerifyDistances.views

  return { views }
}

async function verifyMovingBob({
  movingBob,
  bobDeparture,
  server,
  clock,
  turnsRepository,
  turnProcessor,
  clients,
  gameId,
  views,
  movingBobId,
}: VerifyMovingBobInput): Promise<VerifyMovingBobResult> {
  expect(movingBob.distanceToEnd).toBeCloseTo(3.116999448433268, 12)
  const bobContinuationDistances = [2.116999448433268, 1.116999448433268, 0.116999448433268]
  for (const expectedDistance of bobContinuationDistances) {
    bobDeparture = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = bobDeparture.views
    const currentMovement = required(views[1]).fleets.find(({ id }) => id === movingBobId)
    Assert.isDefined(currentMovement)
    expect(currentMovement.movement).toBeDefined()
    expect(currentMovement.distanceToEnd).toBeCloseTo(expectedDistance, 12)
  }

  return { bobDeparture, views }
}

function assertPersistedNextRngStateValue1(input: AssertPersistedNextRngStateValue1Input): void {
  const assertPersistedNextRngStatePhase12Value1 = input.publicReplay.value

  assertPersistedNextRngState({ ...input, assertPersistedNextRngStatePhase12Value1 })
}

type VerifyUpdatedVerifyDistancesInput = {
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

type VerifyUpdatedVerifyDistancesResult = { views: PlayerView[] }

type VerifyMovingBobInput = {
  movingBob: Fleet
  bobDeparture: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>
  server: ConcurrencyTestApiServer
  clock: ControlledClock
  turnsRepository: TurnsRepository
  turnProcessor: TurnProcessor
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  views: PlayerView[]
  movingBobId: FleetId
}

type VerifyMovingBobResult = { bobDeparture: Awaited<ReturnType<typeof CapturedprocessTurnWithReplay>>; views: PlayerView[] }

type AssertPersistedNextRngStateValue1Input = {
  publicReplay: Success<ResolvedTurnState>
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
  finalReplay: ReturnType<typeof replayWorkerInputWithState>
  ownerByFleet: Array<{ ownerPlayerId: undefined | PlayerId; strength: undefined | NonNegativeSafeInteger }>
  views: PlayerView[]
  homeIdsByPlayer: PlayerId[]
}

async function prepareClockScenario(input: PrepareClockScenarioInput): Promise<PrepareClockScenarioResult> {
  const clockSetup6 = await createClockSetup({ server: input.server })
  const { clock, clients, gameId, turnProcessor, turnsRepository, homes, homeIdsByPlayer, target } = clockSetup6
  let { views } = clockSetup6

  const distances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))

  const updatedVerifyUpdatedVerifyDistances = await verifyUpdatedVerifyDistances({ ...clockSetup6, distances })
  views = updatedVerifyUpdatedVerifyDistances.views

  let stage = await processTurnWithReplay({
    server: input.server,
    clock,
    turnsRepository,
    turnProcessor,
    clients,
    gameId,
    turn: required(views[0]).turn,
  })
  views = stage.views

  const stagedAliceJourneyIdSetup7 = await createStagedAliceJourneyIdSetup({
    ...clockSetup6,
    views,
    stage,
    server: input.server,
  })
  const { updatedVerifyPublicState } = stagedAliceJourneyIdSetup7
  stage = updatedVerifyPublicState.stage
  views = updatedVerifyPublicState.views
  return {
    clockSetup6,
    clients,
    gameId,
    turnProcessor,
    homeIdsByPlayer,
    target,
    views,
    distances,
    stagedAliceJourneyIdSetup7,
  }
}

type PrepareClockScenarioInput = { server: ConcurrencyTestApiServer }

type PrepareClockScenarioResult = {
  clockSetup6: Awaited<ReturnType<typeof CapturedcreateClockSetup>>
  clients: readonly [AuthenticatedApiClient, AuthenticatedApiClient, AuthenticatedApiClient]
  gameId: GameId
  turnProcessor: TurnProcessor
  homeIdsByPlayer: PlayerId[]
  target: Planet
  views: PlayerView[]
  distances: number[]
  stagedAliceJourneyIdSetup7: Awaited<ReturnType<typeof CapturedcreateStagedAliceJourneyIdSetup>>
}
