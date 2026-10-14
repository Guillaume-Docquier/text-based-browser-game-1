import { Assert, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { Fleet, PlayerView, Planet, Action } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { MoveFleetImproved } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { assertMath, assertActionSelections, assertJourney2 } from "../../tests/fleet-assertions/gameplay.router.composed-parity-2.ts"
import { assertRedirectedTargets, assertSecondReload } from "../../tests/fleet-assertions/gameplay.router.composed-parity-3.ts"
import { RenamedComposedAssault, RenamedComposedAssaultRuleset } from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("gameplay.router", () => {
  describe("updateActionSubmission", () => {
    integrationTest("should reject an action with invalid planet targets", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      // Act
      const invalidSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildFleet.id,
          selectedTargets: { planet: "123456789" },
        }),
      })

      // Assert
      await expect(invalidSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject setting an action for a stale turn", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)

      // Act
      const updateActionSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 0,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: makeMoreMoney.id, selectedTargets: {} }),
      })

      // Assert
      await expect(updateActionSubmission).rejects.toMatchObject({ data: { code: "CONFLICT" } })
    })

    integrationTest("should reject setting an action after the turn deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })

      // Act
      const updateActionSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: makeMoreMoney.id, selectedTargets: {} }),
      })

      // Assert
      await expect(updateActionSubmission).rejects.toMatchObject({
        data: { code: "CONFLICT" },
      })
    })

    integrationTest("should reject an action the player cannot afford", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const winTheGame = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === WinTheGame.id)
      Assert.isDefined(winTheGame)

      // Act
      const setActionPromise = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: winTheGame.id, selectedTargets: {} }),
      })

      // Assert
      await expect(setActionPromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest(
      "should honor renamed Assault tags and reject invalid public Fleet selections",
      async ({ db }) => {
        // Public game setup, repeated worker turns, and full readbacks can exceed 15 seconds under combined coverage.
        // Arrange: create the foreign-game Fleet through public actions and the production worker.
        const clock = new ControlledClock()
        const apiServices = await createApiStub({ db, clock })
        Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(RenamedComposedAssaultRuleset))
        using apiServer = new ApiServer(apiServices)
        const alice = await apiServer.createClient({ authenticated: true })
        const bob = await apiServer.createClient({ authenticated: true })
        const { turnProcessor } = await createTurnProcessorStub({ db, clock })
        const processReadyTurn = async (gameId: number, turn: number, clients: ReadonlyArray<typeof alice>): Promise<void> => {
          await Promise.all(
            clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })),
          )
          expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        }

        const createForeignFleetSetupPhase1Result = await createForeignFleetSetup({ alice, processReadyTurn, bob })
        const { gameId, planets, aliceHome, bobHome, source } = createForeignFleetSetupPhase1Result
        let { aliceView, bobView } = createForeignFleetSetupPhase1Result
        const defender = bobView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === bobView.player.id && originPlanetId === bobHome.id && movement === undefined,
        )
        Assert.isDefined(source)
        Assert.isDefined(defender)
        expect(source.strength).toBe(50)
        expect(defender.strength).toBe(20)

        // Act & Assert: the standalone definition is a legal no-op at its own source when no enemy is present.
        const stationaryAssault = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
        Assert.isDefined(stationaryAssault)

        const updatedVerifyActionSelections = await assertActionSelections({
          alice,
          gameId,
          aliceView,
          stationaryAssault,
          source,
          aliceHome,
          processReadyTurn,
          bob,
          defender,
        })
        aliceView = updatedVerifyActionSelections.aliceView

        // Arrange: create a genuinely moving source with an ordinary public Move and worker turn.
        const movingView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const movingDestination = planets
          .filter(({ ownerPlayerId, id }) => ownerPlayerId === null && id !== aliceHome.id)
          .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
          .filter(({ distance }) => distance > 4 && distance <= 10)
          .toSorted((left, right) => left.distance - right.distance)[0]
        const moveAction = movingView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
        Assert.isDefined(movingDestination)
        Assert.isDefined(moveAction)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: movingView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: moveAction.id,
            selectedTargets: { fleet: source.id, planet: movingDestination.planet.id },
            selectedInputs: { strength: 1 },
          }),
        })
        await processReadyTurn(gameId, movingView.turn, [alice, bob])
        aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const movingSource = aliceView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
        const currentSource = aliceView.fleets.find(({ id }) => id === source.id)
        Assert.isDefined(movingSource)
        Assert.isDefined(currentSource)
        expect(movingSource).toMatchObject({
          strength: 1,
          distanceToEnd: movingDestination.distance - 1,
          destinationPlanetId: movingDestination.planet.id,
          movement: { speed: 1 },
        })
        expect(currentSource.strength).toBe(49)

        const customAction = aliceView.actions.find(({ id }) => id === `${RenamedComposedAssault.id}_1`)
        Assert.isDefined(customAction)
        const rejectDraftWithoutMutation = async (
          selectedTargets: Record<string, string>,
          selectedInputs: Record<string, number>,
        ): Promise<void> => {
          const beforeRejectedDraft = await alice.client.gameplay.getPlayerView.query({ gameId })
          const submittedActionTargets = createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets,
            selectedInputs: { units: 1 },
          })
          Object.defineProperty(submittedActionTargets, "selectedInputs", { value: selectedInputs, enumerable: true })
          await expect(
            alice.client.gameplay.updateActionSubmission.mutate({
              gameId,
              turn: beforeRejectedDraft.turn,
              submittedActionTargets,
            }),
          ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
          expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeRejectedDraft)
        }

        const createValidTargetsSetupPhase2Result = await createValidTargetsSetup({
          ...createForeignFleetSetupPhase1Result,
          source,
          rejectDraftWithoutMutation,
          defender,
          movingSource,
          alice,
          aliceView,
          customAction,
          processReadyTurn,
          bob,
        })
        const { validTargets, firstReload, journey, freeComposedAction, occupiedComposedAction, occupiedJourney } =
          createValidTargetsSetupPhase2Result
        expect(occupiedJourney.movement?.submission).toStrictEqual({
          id: customAction.id,
          playerId: aliceView.player.id,
          actionDefinitionId: RenamedComposedAssault.id,
          selectedTargets: validTargets,
          selectedInputs: { units: 30 },
        })

        const redirectPlanet = planets
          .filter(({ id }) => id !== aliceHome.id && id !== bobHome.id)
          .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
          .filter(({ distance }) => distance <= 5)
          .toSorted((left, right) => left.distance - right.distance)[0]
        Assert.isDefined(redirectPlanet)

        await assertRedirectedTargets({
          source,
          redirectPlanet,
          alice,
          gameId,
          firstReload,
          freeComposedAction,
          customAction,
          occupiedComposedAction,
          journey,
          occupiedJourney,
          validTargets,
        })

        await assertSecondReload({
          processReadyTurn,
          gameId,
          firstReload,
          alice,
          bob,
          journey,
          defender,
          aliceView,
          bobHome,
          source,
          aliceHome,
          customAction,
        })
      },
      30_000,
    )

    integrationTest("should reject an action that is not available to the player", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)

      // Act
      const setActionPromise = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: "unavailable-action", selectedTargets: {} }),
      })

      // Assert
      await expect(setActionPromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })
  })
})

async function createForeignFleetSetup({
  alice,
  processReadyTurn,
  bob,
}: CreateForeignFleetSetupInput): Promise<CreateForeignFleetSetupResult> {
  const { createdGameId: foreignGameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({ rulesetId: RenamedComposedAssaultRuleset.id, nbSeats: 1, mapGenerationSeed: 147 }),
  })
  await alice.client.games.startGame.mutate({ gameId: foreignGameId })
  const foreignView = await alice.client.gameplay.getPlayerView.query({ gameId: foreignGameId })
  const foreignHome = foreignView.galaxy.systems
    .flatMap(({ planets }) => planets)
    .find(({ ownerPlayerId }) => ownerPlayerId === foreignView.player.id)
  const foreignBuild = foreignView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
  Assert.isDefined(foreignHome)
  Assert.isDefined(foreignBuild)
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId: foreignGameId,
    turn: foreignView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: foreignBuild.id,
      selectedTargets: { planet: foreignHome.id },
      selectedInputs: {},
    }),
  })
  await processReadyTurn(foreignGameId, foreignView.turn, [alice])
  const foreignBuiltView = await alice.client.gameplay.getPlayerView.query({ gameId: foreignGameId })
  const foreignFleet = foreignBuiltView.fleets.find(({ originPlanetId }) => originPlanetId === foreignHome.id)
  Assert.isDefined(foreignFleet)
  expect(foreignFleet.strength).toBe(10)

  // Arrange: create the fixed seed-147 two-owner route and build the 50/20 fleets publicly.
  const { createdGameId: gameId } = await alice.client.games.create.mutate({
    configuration: createGameConfigurationStub({
      rulesetId: RenamedComposedAssaultRuleset.id,
      nbSeats: 2,
      mapGenerationSeed: 147,
    }),
  })
  await bob.client.games.join.mutate({ gameId })
  await alice.client.games.startGame.mutate({ gameId })
  let aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
  let bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
  const planets = aliceView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
  const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === aliceView.player.id)
  const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
  Assert.isDefined(aliceHome)
  Assert.isDefined(bobHome)

  const updatedVerifyMath = await assertMath({ aliceHome, bobHome, aliceView, alice, gameId, bobView, bob, processReadyTurn })
  aliceView = updatedVerifyMath.aliceView
  bobView = updatedVerifyMath.bobView
  const source = aliceView.fleets.find(
    ({ ownerPlayerId, originPlanetId, movement }) =>
      ownerPlayerId === aliceView.player.id && originPlanetId === aliceHome.id && movement === undefined,
  )
  return { foreignFleet, gameId, aliceView, bobView, planets, aliceHome, bobHome, source }
}

async function createValidTargetsSetup({
  source,
  bobHome,
  rejectDraftWithoutMutation,
  defender,
  aliceHome,
  movingSource,
  foreignFleet,
  planets,
  alice,
  gameId,
  aliceView,
  customAction,
  processReadyTurn,
  bob,
}: CreateValidTargetsSetupInput): Promise<CreateValidTargetsSetupResult> {
  const validTargets = { originForce: source.id, landingSite: bobHome.id }
  await rejectDraftWithoutMutation(validTargets, {})
  await rejectDraftWithoutMutation(validTargets, { units: 0 })
  await rejectDraftWithoutMutation(validTargets, { units: 1.5 })
  await rejectDraftWithoutMutation({ originForce: defender.id, landingSite: aliceHome.id }, { units: 1 })
  await rejectDraftWithoutMutation({ originForce: movingSource.id, landingSite: bobHome.id }, { units: 1 })
  await rejectDraftWithoutMutation({ originForce: foreignFleet.id, landingSite: bobHome.id }, { units: 1 })
  const distantPlanet = planets
    .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
    .filter(({ distance }) => distance > 5)
    .toSorted((left, right) => right.distance - left.distance)[0]
  Assert.isDefined(distantPlanet)
  await rejectDraftWithoutMutation({ originForce: source.id, landingSite: distantPlanet.planet.id }, { units: 1 })

  // Act: submit the renamed, two-instance action through the public API and resolve it with the real worker.
  await alice.client.gameplay.updateActionSubmission.mutate({
    gameId,
    turn: aliceView.turn,
    submittedActionTargets: createSubmittedActionTargetsDtoStub({
      actionId: customAction.id,
      selectedTargets: validTargets,
      selectedInputs: { units: 30 },
    }),
  })
  const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
  expect(selectedView.actions.find(({ id }) => id === customAction.id)).toMatchObject({
    actionDefinitionId: RenamedComposedAssault.id,
    selectedTargets: validTargets,
    selectedInputs: { units: 30 },
  })
  expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 87, uncommitted: 80 })
  expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 97, uncommitted: 95 })

  await processReadyTurn(gameId, selectedView.turn, [alice, bob])
  const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId })
  const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === customAction.id)
  const remainder = firstReload.fleets.find(({ id }) => id === source.id)
  Assert.isDefined(journey)
  Assert.isDefined(remainder)

  assertJourney2({ journey, bobHome, customAction, validTargets, remainder, source, aliceHome, firstReload, defender })

  // The composed action remains locked while its captured selection travels. Verify the same edits
  // would be valid through the free second instance, then prove each rejected API attempt preserves
  // the exact public view, saved journey, selections, and resources.
  const freeComposedAction = firstReload.actions.find(({ id }) => id === `${RenamedComposedAssault.id}_2`)
  const occupiedComposedAction = firstReload.actions.find(({ id }) => id === customAction.id)
  const occupiedJourney = firstReload.fleets.find(({ id }) => id === journey.id)
  Assert.isDefined(freeComposedAction)
  Assert.isDefined(occupiedComposedAction)
  Assert.isDefined(occupiedJourney)
  expect(freeComposedAction.isInProgress).toBe(false)
  expect(occupiedComposedAction.isInProgress).toBe(true)
  return { validTargets, firstReload, journey, freeComposedAction, occupiedComposedAction, occupiedJourney }
}

type CreateForeignFleetSetupInput = {
  alice: AuthenticatedApiClient
  processReadyTurn: (gameId: number, turn: number, clients: readonly AuthenticatedApiClient[]) => Promise<void>
  bob: AuthenticatedApiClient
}

type CreateForeignFleetSetupResult = {
  foreignFleet: Fleet
  gameId: GameId
  aliceView: PlayerView
  bobView: PlayerView
  planets: Planet[]
  aliceHome: Planet
  bobHome: Planet
  source: undefined | Fleet
}

type CreateValidTargetsSetupInput = {
  source: Fleet
  bobHome: Planet
  rejectDraftWithoutMutation: (selectedTargets: Record<string, string>, selectedInputs: Record<string, number>) => Promise<void>
  defender: Fleet
  aliceHome: Planet
  movingSource: Fleet
  foreignFleet: Fleet
  planets: Planet[]
  alice: AuthenticatedApiClient
  gameId: GameId
  aliceView: PlayerView
  customAction: Action
  processReadyTurn: (gameId: number, turn: number, clients: readonly AuthenticatedApiClient[]) => Promise<void>
  bob: AuthenticatedApiClient
}

type CreateValidTargetsSetupResult = {
  validTargets: { originForce: FleetId; landingSite: PlanetId }
  firstReload: PlayerView
  journey: Fleet
  freeComposedAction: Action
  occupiedComposedAction: Action
  occupiedJourney: Fleet
}
