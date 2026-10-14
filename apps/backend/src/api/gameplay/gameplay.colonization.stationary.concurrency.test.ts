import { Assert, Logger, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { eq } from "drizzle-orm"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { describe, expect, it } from "vitest"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { fleetsTable, turnsTable } from "#lib/db/schema.ts"
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
  BuildFleet35,
  BuildFleet48,
  BuildFleet70,
  PublicColonizationFixtureRuleset,
  logReceipt,
  required,
  playerIdFor,
  matchesPublicFleet,
  findPublicFleet,
  findPlayerAction,
  submitAction,
  readViews,
  createPublicNaturalRouteFixture,
  publiclyBuildFleetToFifty,
} from "../../tests/colonization/gameplay.colonization.ts"

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

    const verifyAssertJourneyState1Phase1 = async (): Promise<void> => {
      const assertJourneyState1 = async (): Promise<void> => {
        expect(journey).toMatchObject({
          strength: 35,
          originPlanetId: home.id,
          destinationPlanetId: target.id,
          distanceToEnd: expect.closeTo(0.1456435045942517, 12),
          movement: {
            speed: 1,
            departureTurn: selectedView.turn,
            submission: {
              id: colonizeActionId,
              actionDefinitionId: ColonizePlanetTest.id,
              selectedTargets: { fleet: sourceFleet.id, planet: target.id },
              selectedInputs: { strength: 35 },
            },
            pendingArrivalEffects: [
              {
                definitionOrdinal: 2,
                effectDefinition: {
                  type: "FLEET_COLONIZE",
                  targets: {
                    fleet: { actionTargetTag: "fleet" },
                    planet: { actionTargetTag: "planet" },
                  },
                  parameters: { strengthRequirement: 20 },
                },
              },
            ],
          },
        })
        expect(sourceRemainder).toMatchObject({ id: sourceFleet.id, name: sourceFleet.name, strength: 15, originPlanetId: home.id })
        expect(getPlanets(departedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
        expect(departedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
        expect(departedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
        expect(departedView.actions.find(({ id }) => id === colonizeActionId)?.isInProgress).toBe(true)

        await expect(
          player.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: departedView.turn,
            submittedActionTargets: {
              actionId: colonizeActionId,
              selectedTargets: { fleet: journey.id, planet: target.id },
              selectedInputs: { strength: 34 },
            },
          }),
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        await expect(
          player.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: departedView.turn,
            submittedActionTargets: { actionId: colonizeActionId, selectedTargets: null, selectedInputs: null },
          }),
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
        expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(departedView)
      }
      await assertJourneyState1()
    }
    await verifyAssertJourneyState1Phase1()

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

    const verifyReplayedArrivalPhase2 = async (): Promise<void> => {
      expect(replayedArrival.arrivedAtTick).toBe(3)

      const arrivedView = await processTurn({
        clock,
        turnsRepository,
        turnProcessor,
        client: player.client,
        gameId,
        turn: departedView.turn,
      })
      const claimedFleet = getFleetAt(arrivedView, arrivedView.player.id, target.id, 15)
      expect(getPlanets(arrivedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(arrivedView.player.id)
      expect(claimedFleet.strength).toBe(15)
      expect(claimedFleet.movement).toBeUndefined()
      expect(getFleetAt(arrivedView, arrivedView.player.id, home.id, 15)).toMatchObject({ id: sourceFleet.id })
      expect(arrivedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
      expect(arrivedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
      expect(arrivedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(arrivedView.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      logReceipt("[C3-14 public natural route receipt]", {
        gameId,
        seed: 1234,
        player: arrivedView.player.id,
        home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        routeDistance: 1.1456435045942517,
        buildSubmissions: 5,
        departure: { turn: selectedView.turn, selected: 35, sourceRemainder: 15, journeyForce: 35, remainingDistance: 0.1456435045942517 },
        arrival: { turn: arrivedView.turn, tick: 3, owner: arrivedView.player.id, targetForce: claimedFleet.strength },
        observedReplay: {
          source: "captured genuine worker input before real worker processing",
          inputTurn: arrivalInput.turn,
          arrivedAtTick: replayedArrival.arrivedAtTick,
        },
        resources: {
          influence: arrivedView.resources[ResourceType.INFLUENCE].total,
          fuel: arrivedView.resources[ResourceType.FUEL].total,
          colony: arrivedView.resources[ResourceType.COLONY].total,
        },
        pendingActionAfterDeparture: departedView.actions.find(({ id }) => id === colonizeActionId),
        releasedActionAfterArrival: arrivedView.actions.find(({ id }) => id === colonizeActionId),
      })
    }
    await verifyReplayedArrivalPhase2()

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

    const verifyMoveDistancePhase3 = async (): Promise<void> => {
      expect({
        id: moveDestination.id,
        name: moveDestination.name,
        coordinates: moveDestination.coordinates,
        x: moveDestination.x,
        y: moveDestination.y,
      }).toStrictEqual({
        id: "3f56a5c2-d379-5b15-a6c5-1d5948724fea",
        name: "planet 499054",
        coordinates: "45:98:25",
        x: 58.43825730690875,
        y: 49.61937512280339,
      })
      expect(moveDistance).toBeCloseTo(0.0002590998724286934, 12)
      await movePlayer.client.gameplay.updateActionSubmission.mutate({
        gameId: moveGameId,
        turn: moveColonizePending.turn,
        submittedActionTargets: {
          actionId: moveAction.id,
          selectedTargets: { fleet: sourceWithFifteen.id, planet: moveDestination.id },
          selectedInputs: { strength: 5 },
        },
      })
    }
    await verifyMoveDistancePhase3()

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

    const verifyReplayedMovedFivePhase4 = async (): Promise<void> => {
      expect(replayedMovedFive.arrivedAtTick).toBe(1)
      const bothInProgress = await processTurn({
        clock: moveClock,
        turnsRepository: moveTurns,
        turnProcessor: moveProcessor,
        client: movePlayer.client,
        gameId: moveGameId,
        turn: simultaneousSelections.turn,
      })
      expect(getPlanets(bothInProgress).find(({ id }) => id === moveFixture.target.id)?.ownerPlayerId).toBe(bothInProgress.player.id)
      expect(getFleetAt(bothInProgress, bothInProgress.player.id, moveHome.id, 10)).toMatchObject({ id: moveSource.id })
      const movedFive = getFleetAt(bothInProgress, bothInProgress.player.id, moveDestination.id, 5)
      expect(movedFive.ownerPlayerId).toBe(bothInProgress.player.id)
      expect(movedFive.movement).toBeUndefined()
      expect(movedFive.id).toBe(replayedMovedFive.id)
      expect(bothInProgress.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 22, uncommitted: 22 })
      expect(bothInProgress.resources[ResourceType.FUEL]).toStrictEqual({ total: 9, uncommitted: 9 })
      expect(bothInProgress.actions.find(({ id }) => id === moveColonizeId)?.isInProgress).toBe(false)
      logReceipt("[C3-14 public reservation positive-control receipt]", {
        gameId: moveGameId,
        home: { id: moveHome.id, name: moveHome.name, coordinates: moveHome.coordinates, x: moveHome.x, y: moveHome.y },
        moveDestination: {
          id: moveDestination.id,
          name: moveDestination.name,
          coordinates: moveDestination.coordinates,
          x: moveDestination.x,
          y: moveDestination.y,
          distance: moveDistance,
        },
        initialSource: 15,
        ordinaryMove: {
          actionContent: "independent TestRuleset Move Fleet Standard",
          selected: 5,
          remainingSource: 10,
          configuredSpeed: 0.1,
        },
        moveArrivalReplay: { inputTurn: moveInput.turn, arrivedAtTick: replayedMovedFive.arrivedAtTick },
        colonizeInstanceRemainedLockedUntilResolution: true,
        resourcesAfterBothCosts: { influence: 22, fuel: 9 },
      })
    }
    await verifyReplayedMovedFivePhase4()
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

    const verifyOutOfRangeDistancePhase5 = async (): Promise<void> => {
      expect({
        id: outOfRangeTarget.id,
        name: outOfRangeTarget.name,
        coordinates: outOfRangeTarget.coordinates,
        x: outOfRangeTarget.x,
        y: outOfRangeTarget.y,
      }).toStrictEqual({
        id: "72f899ea-98e3-5c0e-b896-f41c0b3bf6c5",
        name: "planet 596186",
        coordinates: "54:18:10",
        x: 48.592171610357454,
        y: 51.996922937376276,
      })
      const outOfRangeDistance = Math.hypot(home.x - outOfRangeTarget.x, home.y - outOfRangeTarget.y)
      expect(outOfRangeDistance).toBeCloseTo(10.129282735155494, 12)
      expect(outOfRangeTarget.ownerPlayerId).toBeNull()
      const beforeOutOfRangeAttempt = await player.client.gameplay.getPlayerView.query({ gameId })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: builtView.turn,
          submittedActionTargets: {
            actionId: seedOutpostAction.id,
            selectedTargets: { force: sourceFleet.id, site: outOfRangeTarget.id },
            selectedInputs: { quota: 30 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOutOfRangeAttempt)
      const unchangedAfterQuotaFailure = await player.client.gameplay.getPlayerView.query({ gameId })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: builtView.turn,
          submittedActionTargets: {
            actionId: seedOutpostAction.id,
            selectedTargets: { force: sourceFleet.id, site: target.id },
            selectedInputs: { quota: 29 },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(unchangedAfterQuotaFailure)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: builtView.turn,
        submittedActionTargets: {
          actionId: seedOutpostAction.id,
          selectedTargets: { force: sourceFleet.id, site: target.id },
          selectedInputs: { quota: 30 },
        },
      })
      const quotaThirtyView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(quotaThirtyView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
        actionDefinitionId: SeedOutpost.id,
        selectedTargets: { force: sourceFleet.id, site: target.id },
        selectedInputs: { quota: 30 },
      })
      expect(quotaThirtyView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
      expect(quotaThirtyView.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: quotaThirtyView.turn,
        submittedActionTargets: {
          actionId: seedOutpostAction.id,
          selectedTargets: { force: sourceFleet.id, site: target.id },
          selectedInputs: { quota: 45 },
        },
      })
    }
    await verifyOutOfRangeDistancePhase5()

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

    const verifyAssertActualWorkerInputState1Phase6 = (): void => {
      const assertActualWorkerInputState1 = (): void => {
        expect(actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id]).toMatchObject({
          id: "TEST_SEED_OUTPOST",
          name: "Seed Outpost",
          tier: "IMPROVED",
          inputs: { quota: { type: "POSITIVE_INTEGER" } },
          effects: [
            {
              type: "FLEET_MOVE",
              targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
              inputs: { strength: { actionInputTag: "quota", inputType: "POSITIVE_INTEGER" } },
              parameters: { speed: 2 },
            },
            {
              type: "FLEET_COLONIZE",
              targets: { fleet: { actionTargetTag: "force" }, planet: { actionTargetTag: "site" } },
              parameters: { strengthRequirement: 30 },
            },
          ],
        })
        expect(actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
          selectedTargets: { force: sourceFleet.id, site: target.id },
          selectedInputs: { quota: 45 },
        })
      }
      assertActualWorkerInputState1()
    }
    verifyAssertActualWorkerInputState1Phase6()

    const alternateReplay = replayWorkerInput(actualWorkerInput)
    Assert.isSuccess(alternateReplay)
    const replayedSeedFleet = findPublicFleet(Object.values(alternateReplay.value.fleets), {
      ownerPlayerId: selectedView.player.id,
      originPlanetId: target.id,
      strength: 15,
    })
    Assert.isDefined(replayedSeedFleet)

    const verifyReplayedSeedFleetPhase7 = async (): Promise<void> => {
      expect(replayedSeedFleet.arrivedAtTick).toBe(12)

      const resolvedView = await processTurn({
        clock,
        turnsRepository,
        turnProcessor,
        client: player.client,
        gameId,
        turn: selectedView.turn,
      })
      const claimedFleet = getFleetAt(resolvedView, resolvedView.player.id, target.id, 15)
      expect(getPlanets(resolvedView).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(resolvedView.player.id)
      expect(claimedFleet.strength).toBe(15)
      expect(claimedFleet.movement).toBeUndefined()
      expect(getFleetAt(resolvedView, resolvedView.player.id, home.id, 5)).toMatchObject({ id: sourceFleet.id })
      expect(resolvedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 43, uncommitted: 43 })
      expect(resolvedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
      expect(resolvedView.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(resolvedView.actions.find(({ id }) => id === seedOutpostAction.id)).toMatchObject({
        actionDefinitionId: SeedOutpost.id,
        selectedTargets: null,
        isInProgress: false,
      })
      logReceipt("[C3-20 public alternate natural-route receipt]", {
        gameId,
        seed: 1234,
        player: resolvedView.player.id,
        home: { id: home.id, name: home.name, coordinates: home.coordinates, x: home.x, y: home.y },
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        routeDistance: 1.1456435045942517,
        definition: {
          id: SeedOutpost.id,
          name: SeedOutpost.name,
          tier: SeedOutpost.tier,
          tags: { fleet: "force", planet: "site", input: "quota" },
        },
        apiBoundary: { rejectedQuota: 29, acceptedQuota: 30, finalSelectedForce: 45 },
        arrival: { tick: 12, selectedForce: 45, targetForce: claimedFleet.strength, homeRemainder: 5 },
        observedReplay: {
          source: "captured genuine worker input before real worker processing",
          inputTurn: actualWorkerInput.turn,
          arrivedAtTick: replayedSeedFleet.arrivedAtTick,
        },
        payment: { influence: 7, fuel: 2, remaining: { influence: 43, fuel: 8 } },
        loadedActionDefinition: actualWorkerInput.ruleset.actionDefinitions[SeedOutpost.id],
        loadedSubmission: actualWorkerInput.submittedActions.find(({ id }) => id === seedOutpostAction.id),
      })
    }
    await verifyReplayedSeedFleetPhase7()
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

    const verifyAssertFindPlayerActionState1ResolvedPhase8Value1 = replay.resolved.value
    const verifyAssertFindPlayerActionState1ResolvedPhase8 = async (): Promise<void> => {
      const assertFindPlayerActionState1Resolved = verifyAssertFindPlayerActionState1ResolvedPhase8Value1
      const assertFindPlayerActionState1 = async (): Promise<void> => {
        expect(findPlayerAction(workerInput.submittedActions, colonizeActionId, playerIdFor(player))).toMatchObject({
          actionDefinitionId: SeedOutpostHere.id,
          selectedTargets: { force: stationary.id, site: target.id },
          selectedInputs: {},
        })
        expect(workerInput.ruleset.actionDefinitions[SeedOutpostHere.id]).toMatchObject({
          id: "TEST_SEED_OUTPOST_HERE",
          name: "Seed Outpost Here",
          tier: "IMPROVED",
          targets: {
            force: { targetType: "FLEET" },
            site: { targetType: "PLANET" },
          },
          effects: [{ type: "FLEET_COLONIZE", parameters: { strengthRequirement: 30 } }],
        })
        expect(assertFindPlayerActionState1Resolved.removedFleetIds).toContain(stationary.id)
        expect(assertFindPlayerActionState1Resolved.fleets[stationary.id]).toBeUndefined()
        expect(assertFindPlayerActionState1Resolved.planets[target.id]?.ownerPlayerId).toBe(playerIdFor(player))
        expect(assertFindPlayerActionState1Resolved.planetOwnershipChanges).toStrictEqual([
          { planetId: target.id, ownerPlayerId: playerIdFor(player) },
        ])
        expect(replay.nextRngState).toStrictEqual(workerInput.rngState)

        expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      }
      await assertFindPlayerActionState1()
      view = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(view.turn).toBe(selectedView.turn + 1)
      expect(getPlanets(view).find(({ id }) => id === target.id)?.ownerPlayerId).toBe(playerIdFor(player))
      expect(view.fleets.filter(({ originPlanetId }) => originPlanetId === target.id)).toHaveLength(0)
      expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 93, uncommitted: 93 })
      expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 8, uncommitted: 8 })
      expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
      expect(view.actions.find(({ id }) => id === colonizeActionId)).toMatchObject({ selectedTargets: null, isInProgress: false })
      expect(
        await server.database
          .select()
          .from(fleetsTable)
          .where(eq(fleetsTable.gameId, typedParse(GameIdSchema, gameId))),
      ).not.toContainEqual(expect.objectContaining({ id: stationary.id }))
    }
    await verifyAssertFindPlayerActionState1ResolvedPhase8()

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

    const verifyAssertScenarioState1Phase9 = (): void => {
      const assertScenarioState1 = (): void => {
        expect({ id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y }).toStrictEqual({
          id: "838f0f2a-3fe5-5c47-bf22-ce0d74d8653b",
          name: "planet 457985",
          coordinates: "54:59:10",
          x: 49.41298329646574,
          y: 55.182944416215065,
        })
        expect(homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y }))).toStrictEqual([
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
      assertScenarioState1()
    }
    verifyAssertScenarioState1Phase9()

    const distances = homes.map((home) => Math.hypot(home.x - target.x, home.y - target.y))

    const verifyDistancesPhase10 = async (): Promise<void> => {
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
    }
    await verifyDistancesPhase10()

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

    const verifyPublicStatePhase11 = async (): Promise<void> => {
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
    }
    await verifyPublicStatePhase11()

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

    const verifyPersistedNextRngStatePhase12Value1 = publicReplay.value
    const verifyPersistedNextRngStatePhase12 = (): void => {
      const persistedNextRngState = { generatorState: savedNextTurn.rngGeneratorState, spareNormal: savedNextTurn.rngSpareNormal }
      expect(persistedNextRngState).toStrictEqual(finalTurnInput.rngState)
      logReceipt("[C3-08 public Assault receipt]", {
        gameId,
        seed: 1,
        target: { id: target.id, name: target.name, coordinates: target.coordinates, x: target.x, y: target.y },
        homes: homes.map(({ id, name, coordinates, x, y }) => ({ id, name, coordinates, x, y })),
        distances,
        stagedForces: [35, 70, 48],
        stagedArrivalTicks: { alice: 3, carol: 10 },
        bobJourneyDistanceBeforeFinalTurn: bobJourney.distanceToEnd,
        positiveTickArrival: verifyPersistedNextRngStatePhase12Value1.fleets[bobJourney.id]?.arrivedAtTick,
        loadedRngState: finalTurnInput.rngState,
        replayNextRngState: finalReplay.nextRngState,
        persistedNextRngState,
        replaySurvivors: ownerByFleet,
        persistedOwner: getPlanets(required(views[0])).find(({ id }) => id === target.id)?.ownerPlayerId,
        persistedForces: views.map((view, index) => {
          const ownerPlayerId = required(homeIdsByPlayer[index])
          const fleet = findPublicFleet(view.fleets, { ownerPlayerId, originPlanetId: target.id, stationary: true })
          return { playerId: ownerPlayerId, strength: fleet?.strength }
        }),
      })
    }
    verifyPersistedNextRngStatePhase12()
  })
})
