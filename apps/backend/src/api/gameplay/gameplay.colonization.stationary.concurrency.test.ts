import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  getPlanets,
  getHome,
  getFleetAt,
  processTurn,
  processTurnWithReplay,
  captureWorkerInput,
  replayWorkerInput,
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  SeedOutpost,
  SeedOutpostHere,
  PublicBudgetBuild30,
  PublicBudgetStageFleet,
  PublicStationarySeedOutpostRuleset,
  PublicColonizationFixtureRuleset,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  submitAction,
  readViews,
  createPublicNaturalRouteFixture,
  publiclyBuildFleetToFifty,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  assertScenarioState2,
  assertDistances,
  assertPublicState,
  assertPersistedNextRngState,
} from "../../tests/fleet-assertions/gameplay.colonization.stationary-2.ts"
import {
  assertJourney2,
  assertReplayedArrival,
  assertMoveDistance,
  assertReplayedMovedFive,
  assertOutOfRangeDistance,
  assertActualWorkerInput2,
  assertReplayedSeedFleet,
  assertFindPlayerAction,
} from "../../tests/fleet-assertions/gameplay.colonization.stationary.ts"

describe("public Colonization worker companions", () => {
  it("should preserve the public natural-route cost and locked intent across reloads", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000031")
    const { player, gameId, clock, turnProcessor, turnsRepository, home, target } = fixture
    const { view: builtView, fleet: sourceFleet } = await publiclyBuildFleetToFifty(fixture)

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view: builtView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: sourceFleet.id, planet: target.id },
      selectedInputs: { strength: 35 },
      isInProgress: false,
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 25 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

    const departedView = await processTurn({
      clock,
      turnsRepository,
      turnProcessor,
      client: player.client,
      gameId,
      turn: selectedView.turn,
    })
    const journey = departedView.fleets.find(({ movement }) => movement?.submission.id === colonizeActionId)
    const sourceRemainder = findPublicFleet(departedView.fleets, { fleetId: sourceFleet.id, stationary: true })
    Assert.isDefined(journey)
    Assert.isDefined(sourceRemainder)

    await assertJourney2({
      journey,
      home,
      target,
      selectedView,
      colonizeActionId,
      sourceFleet,
      sourceRemainder,
      departedView,
      player,
      gameId,
    })

    const arrivalInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: departedView.turn,
    })
    const arrivalReplay = replayWorkerInput(arrivalInput)
    Assert.isSuccess(arrivalReplay)
    const replayedArrival = arrivalReplay.value.fleets[journey.id]
    Assert.isDefined(replayedArrival)

    await assertReplayedArrival({
      replayedArrival,
      clock,
      turnsRepository,
      turnProcessor,
      player,
      gameId,
      departedView,
      target,
      home,
      sourceFleet,
      colonizeActionId,
      selectedView,
      arrivalInput,
    })

    const moveFixture = await createPublicNaturalRouteFixture(server, "00000000-0000-4000-8000-000000000032")
    const {
      player: movePlayer,
      gameId: moveGameId,
      clock: moveClock,
      turnProcessor: moveProcessor,
      turnsRepository: moveTurns,
      home: moveHome,
    } = moveFixture
    const { view: moveBuiltView, fleet: moveSource } = await publiclyBuildFleetToFifty(moveFixture)
    const moveColonizeId = await submitAction({
      client: movePlayer.client,
      gameId: moveGameId,
      view: moveBuiltView,
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: { fleet: moveSource.id, planet: moveFixture.target.id },
      selectedInputs: { strength: 35 },
    })
    const selectedMoveColonize = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
    const moveColonizePending = await processTurn({
      clock: moveClock,
      turnsRepository: moveTurns,
      turnProcessor: moveProcessor,
      client: movePlayer.client,
      gameId: moveGameId,
      turn: selectedMoveColonize.turn,
    })
    const pendingJourney = moveColonizePending.fleets.find(({ movement }) => movement?.submission.id === moveColonizeId)
    Assert.isDefined(pendingJourney)
    const sourceWithFifteen = getFleetAt(moveColonizePending, moveColonizePending.player.id, moveHome.id, 15)
    const moveAction = moveColonizePending.actions.find(({ id }) => id === "TEST_MOVE_FLEET_STANDARD_2")
    Assert.isDefined(moveAction)
    expect(moveAction.actionDefinitionId).toBe(MoveFleetStandard.id)
    const moveDestination = getPlanets(moveColonizePending).find(({ coordinates }) => coordinates === "45:98:25")
    Assert.isDefined(moveDestination)
    const moveDistance = Math.hypot(moveDestination.x - moveHome.x, moveDestination.y - moveHome.y)

    await assertMoveDistance({ moveDestination, moveDistance, movePlayer, moveGameId, moveColonizePending, moveAction, sourceWithFifteen })

    const simultaneousSelections = await movePlayer.client.gameplay.getPlayerView.query({ gameId: moveGameId })
    expect(simultaneousSelections.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 22 })
    expect(simultaneousSelections.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(simultaneousSelections.fleets.find(({ id }) => id === sourceWithFifteen.id)?.strength).toBe(15)
    const moveInput = await captureWorkerInput({
      server,
      clock: moveClock,
      turnsRepository: moveTurns,
      gameId: moveGameId,
      turn: simultaneousSelections.turn,
    })
    const moveReplay = replayWorkerInput(moveInput)
    Assert.isSuccess(moveReplay)
    const replayedMovedFive = findPublicFleet(Object.values(moveReplay.value.fleets), {
      ownerPlayerId: simultaneousSelections.player.id,
      originPlanetId: moveDestination.id,
      strength: 5,
    })
    Assert.isDefined(replayedMovedFive)

    await assertReplayedMovedFive({
      replayedMovedFive,
      moveClock,
      moveTurns,
      moveProcessor,
      movePlayer,
      moveGameId,
      simultaneousSelections,
      moveFixture,
      moveHome,
      moveSource,
      moveDestination,
      moveColonizeId,
      moveDistance,
      moveInput,
    })
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
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicStationarySeedOutpostRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000045" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicStationarySeedOutpostRuleset.id,
        nbSeats: 1,
        turnIntervalSeconds: Time.in(MANUAL_TURN_INTERVAL, UnitOfTime.SECONDS),
        mapGenerationSeed: 1234,
      }),
    })
    await player.client.games.startGame.mutate({ gameId })
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId })
    const home = getHome(view)
    const target = getPlanets(view).find(({ id }) => id === "a34e5eae-656c-5330-ac90-9f9a7e0afa5d")
    Assert.isDefined(target)
    expect({ id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y }).toStrictEqual({
      id: "78821e36-f066-5df0-adbd-19785571d245",
      name: "planet 278494",
      coordinates: "45:98:30",
      x: 58.43842436611536,
      y: 49.61917707239218,
    })
    expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
      id: "a34e5eae-656c-5330-ac90-9f9a7e0afa5d",
      name: "planet 684163",
      coordinates: "55:07:50",
      x: 57.77998524757335,
      y: 50.556704120958045,
    })
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 100 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })

    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicBudgetBuild30.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId,
      turn: view.turn,
      submittedActionTargets: {
        actionId: buildAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      },
    })
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
    const arrival = Object.values(staged.resolved.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 30 }),
    )
    Assert.isDefined(arrival)
    expect(arrival.arrivedAtTick).toBeDefined()
    const stationary = getFleetAt(view, view.player.id, target.id, 30)
    expect(stationary.id).toBe(arrival.id)
    expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: SeedOutpostHere.id,
      selectedTargets: { force: stationary.id, site: target.id },
      selectedInputs: {},
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      actionDefinitionId: SeedOutpostHere.id,
      selectedTargets: { force: stationary.id, site: target.id },
      selectedInputs: {},
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 93 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

    const workerInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: selectedView.turn,
    })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)

    const assertAssertFindPlayerActionState1ResolvedPhase8Value1 = replay.resolved.value

    const updatedAssertFindPlayerAction = await assertFindPlayerAction({
      assertAssertFindPlayerActionState1ResolvedPhase8Value1,
      workerInput,
      colonizeActionId,
      player,
      stationary,
      target,
      replay,
      turnProcessor,
      view,
      gameId,
      selectedView,
      server,
    })
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
    const clock = new ControlledClock({ startDate: new Date() })
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationFixtureRuleset))
    const alice = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000011" })
    const bob = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000012" })
    const carol = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000013" })
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
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    let views = await readViews(clients, gameId)
    const homes = views.map(getHome)
    const homeIdsByPlayer = views.map(({ player }) => player.id)
    const target = getPlanets(required(views[0])).find(({ id }) => id === "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b")
    Assert.isDefined(target)

    assertScenarioState2({ target, homes })

    const distances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))

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

    let stage = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = stage.views
    const stagedAliceJourney = findPublicFleet(required(views[0]).fleets, {
      ownerPlayerId: required(homeIdsByPlayer[0]),
      destinationPlanetId: target.id,
    })
    const stagedCarolJourney = findPublicFleet(required(views[2]).fleets, {
      ownerPlayerId: required(homeIdsByPlayer[2]),
      destinationPlanetId: target.id,
    })
    Assert.isDefined(stagedAliceJourney)
    Assert.isDefined(stagedCarolJourney)
    const stagedAliceJourneyId = stagedAliceJourney.id
    const stagedCarolJourneyId = stagedCarolJourney.id
    expect(stagedAliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
    expect(stagedCarolJourney.distanceToEnd).toBeCloseTo(12.277541605730438, 12)
    const stagingResolutions = [stage.resolved]

    const updatedVerifyPublicState = await assertPublicState({
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
    })
    stage = updatedVerifyPublicState.stage
    views = updatedVerifyPublicState.views

    const aliceStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedAliceJourneyId]?.arrivedAtTick !== undefined)
    const carolStagingArrival = stagingResolutions.find(({ fleets }) => fleets[stagedCarolJourneyId]?.arrivedAtTick !== undefined)
    Assert.isDefined(aliceStagingArrival)
    Assert.isDefined(carolStagingArrival)
    expect(aliceStagingArrival.fleets[stagedAliceJourneyId]?.arrivedAtTick).toBe(3)
    expect(carolStagingArrival.fleets[stagedCarolJourneyId]?.arrivedAtTick).toBe(10)
    const stagedAlice = getFleetAt(required(views[0]), required(homeIdsByPlayer[0]), target.id, 35)
    const stagedCarol = getFleetAt(required(views[2]), required(homeIdsByPlayer[2]), target.id, 48)
    expect(
      required(views[0])
        .galaxy.systems.flatMap(({ planets }) => planets)
        .find(({ id }) => id === target.id)?.ownerPlayerId,
    ).toBeNull()

    const bobColonizeActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: ColonizePlanetTest.id,
      selectedTargets: {
        fleet: getFleetAt(required(views[1]), required(homeIdsByPlayer[1]), required(homes[1]).id, 70).id,
        planet: target.id,
      },
      selectedInputs: { strength: 70 },
    })
    let bobDeparture = await processTurnWithReplay({
      server,
      clock,
      turnsRepository,
      turnProcessor,
      clients,
      gameId,
      turn: required(views[0]).turn,
    })
    views = bobDeparture.views
    const movingBob = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(homeIdsByPlayer[1]), destinationPlanetId: target.id }),
    )
    Assert.isDefined(movingBob)
    const movingBobId = movingBob.id
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

    const readyViews = views
    const currentAlice = getFleetAt(required(readyViews[0]), required(homeIdsByPlayer[0]), target.id, 35)
    const currentCarol = getFleetAt(required(readyViews[2]), required(homeIdsByPlayer[2]), target.id, 48)
    const bobJourney = required(readyViews[1]).fleets.find(({ id }) => id === movingBobId)
    Assert.isDefined(bobJourney)
    expect(bobJourney.movement).toBeDefined()
    expect(bobJourney.distanceToEnd).toBeCloseTo(0.116999448433268, 12)
    const aliceColonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(readyViews[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: currentAlice.id, planet: target.id },
      selectedInputs: {},
    })
    const carolAssaultActionId = await submitAction({
      client: carol.client,
      gameId,
      view: required(readyViews[2]),
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: currentCarol.id, battlePlanet: target.id },
      selectedInputs: {},
    })

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(readyViews[0]).turn,
    })
    const finalReplay = replayWorkerInputWithState(finalTurnInput)
    const publicReplay = finalReplay.resolved
    Assert.isSuccess(publicReplay)
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)
    expect(publicReplay.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === carolAssaultActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(
      publicReplay.value.resolvedContinuations
        .find(({ originatingSubmission }) => originatingSubmission.id === bobColonizeActionId)
        ?.actionOutcomes.at(-1)?.type,
    ).toBe("RESOLVED")
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

    const assertPersistedNextRngStatePhase12Value1 = publicReplay.value

    assertPersistedNextRngState({
      savedNextTurn,
      finalTurnInput,
      gameId,
      target,
      homes,
      distances,
      bobJourney,
      assertPersistedNextRngStatePhase12Value1,
      finalReplay,
      ownerByFleet,
      views,
      homeIdsByPlayer,
    })
  })
})
