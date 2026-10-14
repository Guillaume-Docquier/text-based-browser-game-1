import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { turnsTable } from "#lib/db/schema.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import {
  stagePublicMergeScenario,
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
  BuildFleet10ForStaging,
  BuildFleet35,
  BuildFleet50,
  BuildFleet70,
  MoveFleetSpeed10,
  ColonizeFleetSpeed2,
  ColonizeFleetSpeed4,
  DeadEarlierAttackColonize,
  PublicColonizationFixtureRuleset,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  submitAction,
  readViews,
  createPublicTwoPlayerFixture,
} from "../../tests/colonization/gameplay.colonization.ts"
import {
  assertFinalReplay,
  assertPersistedNextRngState,
  assertPersistedNextRngState2,
  assertLaterReplay,
} from "../../tests/fleet-assertions/gameplay.colonization.renamed-content.ts"

describe("public Colonization worker companions", () => {
  it("should publicly prevent a dead earlier claimant and let the arriving Assault colonize", async () => {
    await using server = await ConcurrencyTestApiServer.create()
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
    const clock = new ControlledClock({ startDate: new Date() })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db: server.database, clock })

    let views = await readViews(clients, gameId)
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
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    const aliceJourney = required(views[0]).fleets.find(({ movement }) => movement?.submission.id === aliceMoveActionId)
    Assert.isDefined(aliceJourney)
    expect(aliceJourney.distanceToEnd).toBeCloseTo(5.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(required(views[0]).fleets.find(({ id }) => id === aliceJourney.id)?.distanceToEnd).toBeCloseTo(0.679420165502142, 12)
    stage = await processTurnWithReplay({ server, clock, turnsRepository, turnProcessor, clients, gameId, turn: required(views[0]).turn })
    views = stage.views
    expect(stage.resolved.fleets[aliceJourney.id]?.arrivedAtTick).toBe(3)
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
    expect(finalReplay.resolved.value.fleets[stagedAlice.id]).toBeUndefined()
    expect(finalReplay.resolved.value.fleets[bobJourney.id]?.arrivedAtTick).toBe(3)
    expect(finalReplay.resolved.value.fleets[bobJourney.id]?.strength).toBe(15)
    expect(finalReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(bob))
    expect(
      finalReplay.resolved.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)
        ?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
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
    views = updatedVerifyFinalReplay.views

    const savedTurns = await server.database
      .select()
      .from(turnsTable)
      .where(eq(turnsTable.gameId, typedParse(GameIdSchema, gameId)))
    const savedNextTurn = savedTurns.find(({ turn }) => turn === finalTurn.turn + 1)
    Assert.isDefined(savedNextTurn)

    const assertPersistedNextRngStatePhase2Value1 = finalReplay.resolved.value

    assertPersistedNextRngState({
      savedNextTurn,
      finalReplay,
      gameId,
      target,
      aliceDistance,
      bobDistance,
      stagedAlice,
      bobJourney,
      bobContinuation,
      assertPersistedNextRngStatePhase2Value1,
      aliceColonizeActionId,
      bob,
      finalWorkerInput,
      views,
    })
  })

  it("should preserve arrival provenance while public ordinary and colonization arrivals merge", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, homeB, target } = fixture
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
    expect(friendlyWinner).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 40,
      arrivedAtTick: 3,
    })
    const bobWinner = findPublicFleet(Object.values(publicReplay.value.fleets), {
      ownerPlayerId: required(selectedViews[1]).player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(bobWinner)
    expect(bobWinner.arrivedAtTick).toBe(7)
    expect(publicReplay.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[1]).player.id)
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === aliceColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "PREVENTED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === bobColonizeActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(
      publicReplay.value.resolvedActions.find(({ submittedAction }) => submittedAction.id === ordinaryActionId)?.actionOutcomes,
    ).toContainEqual(expect.objectContaining({ type: "RESOLVED" }))
    expect(finalReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
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

    assertPersistedNextRngState2({
      savedNextTurn,
      finalTurnInput,
      gameId,
      views,
      homeA,
      target,
      stagedFriendly,
      persistedFriendlyFleets,
      finalReplay,
      bobStageActionId,
      aliceStageActionId,
    })
  })

  it("should let the earlier speed-2 claimant beat a later speed-1 arrival on the next Turn", async () => {
    await using server = await ConcurrencyTestApiServer.create()
    const fixture = await createPublicTwoPlayerFixture(server)
    const { alice, bob, clients, gameId, clock, turnProcessor, turnsRepository, homeA, target } = fixture
    const staged = await stagePublicMergeScenario(server, fixture)
    let views = staged.views
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
    const selectedViews = await readViews(clients, gameId)
    expect(required(selectedViews[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 493, uncommitted: 465 })
    expect(required(selectedViews[1]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 495, uncommitted: 470 })

    const finalTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(selectedViews[0]).turn,
    })
    const firstReplay = replayWorkerInputWithState(finalTurnInput)
    Assert.isSuccess(firstReplay.resolved)
    expect(firstReplay.resolved.value.planets[target.id]?.ownerPlayerId).toBe(required(selectedViews[0]).player.id)
    expect(firstReplay.resolved.value.fleets[stagedFriendly.id]).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
      ownerPlayerId: required(selectedViews[0]).player.id,
      originPlanetId: target.id,
      strength: 20,
    })
    const bobJourney = Object.values(firstReplay.resolved.value.fleets).find((fleet) =>
      matchesPublicFleet(fleet, { ownerPlayerId: required(selectedViews[1]).player.id, movementSubmissionId: bobColonizeActionId }),
    )
    Assert.isDefined(bobJourney)
    const bobJourneyId = bobJourney.id
    expect(bobJourney.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(firstReplay.nextRngState).toStrictEqual(finalTurnInput.rngState)

    expect(await turnProcessor.processNextDueTurn()).toBe("processed")
    views = await readViews(clients, gameId)
    expect(getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(required(views[0]).player.id)
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, target.id, 20)).toMatchObject({
      id: stagedFriendly.id,
      name: stagedFriendly.name,
    })
    expect(getFleetAt(required(views[0]), required(views[0]).player.id, homeA.id, 20)).toBeDefined()
    expect(required(views[0]).resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 465, uncommitted: 465 })
    const pendingBob = required(views[1]).fleets.find(({ id }) => id === bobJourneyId)
    Assert.isDefined(pendingBob)
    expect(pendingBob.distanceToEnd).toBeCloseTo(0.2645395167985714, 12)
    expect(required(views[0]).actions.find(({ id }) => id === aliceColonizeActionId)).toMatchObject({
      selectedTargets: null,
      isInProgress: false,
    })
    expect(required(views[1]).actions.find(({ id }) => id === bobColonizeActionId)).toMatchObject({ isInProgress: true })

    const laterTurnInput = await captureWorkerInput({
      server,
      clock,
      turnsRepository,
      gameId,
      turn: required(views[0]).turn,
    })
    const laterReplay = replayWorkerInputWithState(laterTurnInput)
    Assert.isSuccess(laterReplay.resolved)

    const assertLaterReplayPhase4Value1 = laterReplay.resolved.value

    const updatedVerifyLaterReplay = await assertLaterReplay({
      assertLaterReplayPhase4Value1,
      target,
      views,
      bobJourneyId,
      bobColonizeActionId,
      laterReplay,
      laterTurnInput,
      turnProcessor,
      clients,
      gameId,
      stagedFriendly,
      ordinaryActionId,
    })
    views = updatedVerifyLaterReplay.views
  })
})
