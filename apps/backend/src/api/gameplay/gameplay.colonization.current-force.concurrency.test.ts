import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
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
  replayWorkerInputWithState,
} from "../../tests/colonization/gameplay.colonization.scenarios.ts"
import {
  MANUAL_TURN_INTERVAL,
  PublicBudgetBuild35,
  PublicBudgetStageFleet,
  PublicColonizationBudgetRuleset,
  BuildFleet10ForStaging,
  BuildFleet35,
  MoveFleetSpeed10,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  findPlayerAction,
  findResolvedAction,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import { assertJourney } from "../../tests/fleet-assertions/gameplay.colonization-2.ts"
import { assertRequired, assertPersistedJourney, assertPersistedNextRngState2 } from "../../tests/fleet-assertions/gameplay.colonization.ts"

describe("public Colonization worker companions", () => {
  it("should use the current public stationary force after Move and Assault before Colonization", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
    let views = fixture.views
    const routeDistance = Math.hypot(homeA.x - target.x, homeA.y - target.y)
    const enemyDistance = Math.hypot(homeB.x - target.x, homeB.y - target.y)
    expect(routeDistance).toBeCloseTo(1.2645395167985714, 12)
    expect(enemyDistance).toBeCloseTo(18.852953053708077, 12)
    expect(target.ownerPlayerId).toBeNull()

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: BuildFleet35.id,
      selectedTargets: { planet: homeA.id },
      selectedInputs: {},
    })
    await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: BuildFleet10ForStaging.id,
      selectedTargets: { planet: homeB.id },
      selectedInputs: {},
    })
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
    const aliceSource = getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 35)
    const bobSource = getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 10)

    await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: aliceSource.id, planet: target.id },
      selectedInputs: { strength: 35 },
    })
    const bobStageMoveId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: MoveFleetSpeed10.id,
      selectedTargets: { fleet: bobSource.id, planet: target.id },
      selectedInputs: { strength: 1 },
    })
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceArrival = findPublicFleet(Object.values(stage.resolved.fleets), {
      ownerPlayerId: playerIdFor(alice),
      originPlanetId: target.id,
      strength: 35,
      arrivedAtTick: 3,
    })
    const bobJourney = required(views[1]).fleets.find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: playerIdFor(bob), movementSubmissionId: bobStageMoveId }),
    )
    Assert.isDefined(aliceArrival)
    Assert.isDefined(bobJourney)
    expect(aliceArrival.arrivedAtTick).toBe(3)
    expect(getFleetAt(required(views[0]), playerIdFor(alice), target.id, 35).id).toBe(aliceArrival.id)
    expect(bobJourney.distanceToEnd).toBeCloseTo(8.852953053708077, 12)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[bobJourney.id]?.arrivedAtTick).toBe(18)
    const aliceStationary = getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 35)
    const bobAssaultFleet = getFleetAt(required(views[1]), required(views[1]).player.id, target.id, 1)
    expect(getFleetAt(required(views[1]), required(views[1]).player.id, homeB.id, 9).strength).toBe(9)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    const moveActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: alice.client,
      gameId,
      view: required(views[0]),
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    const assaultActionId = await submitAction({
      client: bob.client,
      gameId,
      view: required(views[1]),
      actionDefinitionId: StationaryAssaultTest.id,
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const selectedViews = await readViews(clients, gameId)

    assertRequired({ selectedViews, moveActionId, aliceStationary, homeA, colonizeActionId, target, assaultActionId, bobAssaultFleet })

    const turn = required(selectedViews[0]).turn
    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(3)
    expect(workerInput.submittedActions.find(({ id }) => id === moveActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: homeA.id },
      selectedInputs: { strength: 15 },
    })
    expect(workerInput.submittedActions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      selectedTargets: { fleet: aliceStationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(workerInput.submittedActions.find(({ id }) => id === assaultActionId)).toMatchObject({
      selectedTargets: { station: bobAssaultFleet.id, battlePlanet: target.id },
      selectedInputs: {},
    })
    const moveResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === moveActionId)
    const colonizeResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === colonizeActionId)
    const assaultResult = replay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === assaultActionId)
    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    Assert.isDefined(assaultResult)
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(assaultResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.planets[target.id]?.ownerPlayerId).toBeNull()
    expect(replay.resolved.value.planetOwnershipChanges).toStrictEqual([])
    expect(replay.resolved.value.fleets[aliceStationary.id]?.strength).toBe(19)
    expect(replay.resolved.value.fleets[bobAssaultFleet.id]).toBeUndefined()
    expect(replay.resolved.value.removedFleetIds).toContain(bobAssaultFleet.id)
    const outgoingJourney = Object.values(replay.resolved.value.fleets).find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(outgoingJourney)
    expect(outgoingJourney).toMatchObject({
      ownerPlayerId: playerIdFor(alice),
      strength: 15,
      originPlanetId: target.id,
      destinationPlanetId: homeA.id,
      movement: { speed: 0.1, submission: { id: moveActionId }, pendingArrivalEffects: [] },
    })
    expect(outgoingJourney.distanceToEnd).toBeCloseTo(routeDistance - 0.1, 12)
    expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(required(views[0]).turn).toBe(turn + 1)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 19).id).toBe(aliceStationary.id)
    expect(required(views[1]).fleets.find(({ id }) => id === bobAssaultFleet.id)).toBeUndefined()
    const persistedJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === moveActionId)
    Assert.isDefined(persistedJourney)

    assertPersistedJourney({ persistedJourney, target, homeA, moveActionId, routeDistance, views, colonizeActionId })
    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === turn + 1)
    Assert.isDefined(savedNextTurn)

    assertPersistedNextRngState2({
      savedNextTurn,
      replay,
      gameId,
      target,
      routeDistance,
      aliceStationary,
      bobAssaultFleet,
      moveActionId,
      colonizeActionId,
      assaultActionId,
      views,
      colonizeResult,
      persistedJourney,
      homeA,
      workerInput,
    })
  })

  it("should claim a public35-force source after Move15 while preserving the Q-bound remainder15", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const rulesetsRepository = new RulesetsRepository({ db: server.database, logger: Logger.get() })
    Assert.isSuccess(await rulesetsRepository.upsertRuleset(PublicColonizationBudgetRuleset))
    const player = await server.createClient({ authenticated: true, id: "00000000-0000-4000-8000-000000000046" })
    const { createdGameId: gameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicColonizationBudgetRuleset.id,
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
    expect(home.coordinates).toBe("45:98:30")
    expect(target.coordinates).toBe("55:07:50")
    const routeDistance = Math.hypot(home.x - target.x, home.y - target.y)
    expect(routeDistance).toBeCloseTo(1.1456435045942517, 12)
    expect(target.ownerPlayerId).toBeNull()

    const buildActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetBuild35.id,
      selectedTargets: { planet: home.id },
      selectedInputs: {},
    })
    view = await processTurn({ clock, turnsRepository, turnProcessor, client: player.client, gameId, turn: view.turn })
    const source = getFleetAt(view, view.player.id, home.id, 35)
    const stageActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: PublicBudgetStageFleet.id,
      selectedTargets: { fleet: source.id, planet: target.id },
      selectedInputs: { strength: 35 },
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
    const stagedArrival = Object.values(staged.resolved.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: view.player.id, originPlanetId: target.id, strength: 35 }),
    )
    Assert.isDefined(stagedArrival)
    expect(stagedArrival.arrivedAtTick).toBeDefined()
    const stationary = getFleetAt(view, view.player.id, target.id, 35)
    expect(stationary.id).toBe(stagedArrival.id)

    const moveActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    const colonizeActionId = await submitAction({
      client: player.client,
      gameId,
      view,
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const selectedView = await player.client.gameplay.getPlayerView.query({ gameId })
    expect(selectedView.actions.find(({ id }) => id === moveActionId)).toMatchObject({
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(selectedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({
      actionDefinitionId: ColonizeHereTest.id,
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 100, uncommitted: 72 })
    expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 9 })
    expect(selectedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const workerInput = await captureWorkerInput({ server, clock, turnsRepository, gameId, turn: selectedView.turn })
    const replay = replayWorkerInputWithState(workerInput)
    Assert.isSuccess(replay.resolved)
    expect(workerInput.submittedActions).toHaveLength(2)
    expect(findPlayerAction(workerInput.submittedActions, moveActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: home.id },
      selectedInputs: { strength: 15 },
    })
    expect(findPlayerAction(workerInput.submittedActions, colonizeActionId, playerIdFor(player))).toMatchObject({
      selectedTargets: { fleet: stationary.id, planet: target.id },
      selectedInputs: {},
    })
    const moveResult = findResolvedAction(replay.resolved.value.resolvedActions, moveActionId, playerIdFor(player))

    const colonizeResult = findResolvedAction(replay.resolved.value.resolvedActions, colonizeActionId, playerIdFor(player))

    Assert.isDefined(moveResult)
    Assert.isDefined(colonizeResult)
    expect(moveResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(colonizeResult.actionOutcomes).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(replay.resolved.value.removedFleetIds).toContain(stationary.id)
    expect(replay.resolved.value.fleets[stationary.id]).toBeUndefined()
    const journey = findPublicFleet(Object.values(replay.resolved.value.fleets), {
      ownerPlayerId: playerIdFor(player),
      originPlanetId: target.id,
      destinationPlanetId: home.id,
      strength: 15,
      movementSubmissionId: moveActionId,
    })
    Assert.isDefined(journey)

    const assertJourneyPhase6Value1 = replay.resolved.value

    const updatedVerifyJourney = await assertJourney({
      journey,
      routeDistance,
      moveActionId,
      assertJourneyPhase6Value1,
      target,
      player,
      replay,
      workerInput,
      turnProcessor,
      view,
      gameId,
      selectedView,
      home,
      colonizeActionId,
    })
    view = updatedVerifyJourney.view

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn: candidateTurn }) => candidateTurn === workerInput.turn + 1)
    Assert.isDefined(savedNextTurn)
    const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
    expect(persistedNextRngState).toStrictEqual(replay.nextRngState)

    logReceipt("[C3-19 public Move15+stationary Colonize20 success receipt]", {
      gameId,
      seed: 1234,
      home: { id: home.id, coordinates: home.coordinates, x: home.x, y: home.y },
      target: { id: target.id, coordinates: target.coordinates, x: target.x, y: target.y },
      routeDistance,
      staging: { buildActionId, stageActionId, strength: 35, actualArrivalTick: stagedArrival.arrivedAtTick },
      selected: { move15: moveActionId, stationaryColonize20: colonizeActionId },
      result: {
        owner: playerIdFor(player),
        stationary35Consumed: true,
        journey: { id: journey.id, strength: journey.strength, distanceToEnd: journey.distanceToEnd },
      },
      payment: { influence: 28, fuel: 1, remaining: { influence: 72, fuel: 9 } },
      rng: { preResolution: workerInput.rngState, replayNext: replay.nextRngState, persistedNext: persistedNextRngState },
    })
  })
})
