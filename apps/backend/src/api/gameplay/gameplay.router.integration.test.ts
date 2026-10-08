import { Assert, branded, Datetime, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("gameplay.router", () => {
  integrationTest("should reject all gameplay routes when the authenticated player has not joined the game", async ({ db }) => {
    // Arrange
    using apiServer = new ApiServer(await createApiStub({ db }))
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayer.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })).rejects.toMatchObject(
      expectedError,
    )
    await expect(
      nonPlayer.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub(),
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("start", () => {
    integrationTest("should generate a deterministic galaxy from the game's seed", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true, id: "7f80447c-442a-4229-8d52-39b675b3e80c" })
      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      // quick sanity checks
      expect(playerView.galaxy.systems.length).toBeGreaterThan(500) // enough systems are generated
      expect(playerView.galaxy.systems.flatMap(({ planets }) => planets).length).toBeGreaterThan(1500) // enough planets are generated
      expect(
        playerView.galaxy.systems.flatMap((system) => system.planets).find(({ id }) => id === "cd2c40c4-0233-5b79-9d85-2ad751dff9e9"),
      ).toStrictEqual({
        coordinates: "44:76:35", // coordinates make sense
        x: 46.42101792976603,
        y: 47.21423492967076,
        id: "cd2c40c4-0233-5b79-9d85-2ad751dff9e9",
        ownerPlayerId: null,
        name: "planet 685256",
        biome: PlanetBiome.VOLCANIC,
        size: PlanetSize.MEDIUM,
        fertility: 2,
        metal: 1,
        fuel: 2,
        energy: 3,
        maxPopulation: 15,
        area: 5,
      })

      const allStars = playerView.galaxy.systems.map(({ star }) => star)
      expect(new Set(allStars.map((star) => star.coordinates)).size).toStrictEqual(allStars.length) // unique coordinates
      expect(new Set(allStars.map((star) => star.id)).size).toStrictEqual(allStars.length) // unique ids

      const allPlanets = playerView.galaxy.systems.flatMap(({ planets }) => planets)
      expect(new Set(allPlanets.map((planet) => planet.coordinates)).size).toStrictEqual(allPlanets.length) // unique coordinates
      expect(new Set(allPlanets.map((planet) => planet.id)).size).toStrictEqual(allPlanets.length) // unique ids

      expect(playerView.galaxy).toMatchSnapshot()
    })

    integrationTest("should start a game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createLobbyConfigurationDtoStub({ turnIntervalSeconds: 60 })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const lobby = await player.client.lobbies.getById.query({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(startGameResult).toBeUndefined()
      expect(lobby.status).toBe(GameStatus.IN_PROGRESS)
      expect(lobby.startedAt).toBe(clock.now().toISOString())
      expect(playerView.turnEndsAt).toBe(
        Datetime.increment({
          date: clock.now(),
          time: Time.create(newGameSettings.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
      )
    })

    integrationTest("should assign one unique Home Planet to every player", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 3, mapGenerationSeed: 1234 }),
      })
      await firstOpponent.client.lobbies.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const homePlanetsOwnerIds = playerView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .filter(({ ownerPlayerId }) => ownerPlayerId !== null)
        .map(({ ownerPlayerId }) => ownerPlayerId)

      expect(homePlanetsOwnerIds).toHaveLength(3)
      expect(homePlanetsOwnerIds).toStrictEqual(
        expect.arrayContaining([creator.account.id, firstOpponent.account.id, secondOpponent.account.id]),
      )
    })

    integrationTest("should reject starting a game as a non-creator", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const startGame = joiner.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject starting a game that has already started", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const startGame = creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject anonymous game start", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const startGame = anonymous.client.gameplay.startGame.mutate({ gameId: 1 })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getPlayerView", () => {
    integrationTest("should get the authenticated player's state for a started game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createLobbyConfigurationDtoStub()
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: gameConfiguration })

      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const getPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const repeatedGetPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const expectedActions = [
        {
          id: expect.any(String),
          actionDefinitionId: GainInfluence.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: WinTheGame.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainEnergy.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainFuel.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainMetal.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
      ]
      expect(getPlayerViewResult).toStrictEqual<typeof getPlayerViewResult>({
        gameId: createdGameId,
        player: { id: branded(player.account.id), color: PlayerColor.TURQUOISE, isReady: false },
        opponents: {},
        galaxy: expect.any(Object), // Verified by the snapshot test
        fleets: [],
        turn: 1,
        turnStatus: "COLLECTING_ACTIONS",
        turnEndsAt: Datetime.increment({
          date: clock.now(),
          time: Time.create(gameConfiguration.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
        resources: createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 3, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
        ruleset: TestRuleset,
        actions: expect.arrayContaining(expectedActions),
      })
      expect(getPlayerViewResult.actions).toHaveLength(expectedActions.length)
      expect(repeatedGetPlayerViewResult.actions).toStrictEqual(getPlayerViewResult.actions)
    })

    integrationTest("should expose uncommitted resources and use them to determine Action affordability", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const generatePower = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
      Assert.isDefined(generatePower)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: generatePower.id, selectedTargets: {} }),
      })

      // Act
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const selectedGeneratePower = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
      const extractMetal = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
      Assert.isDefined(selectedGeneratePower)
      Assert.isDefined(extractMetal)

      // Assert
      expect(playerView.resources).toStrictEqual<typeof playerView.resources>(
        createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 0, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 0, total: 1 },
        }),
      )
      expect(selectedGeneratePower.canAfford).toBe(true)
      expect(extractMetal.canAfford).toBe(false)
    })

    integrationTest("should expose the current player and every opponent with their colors", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ nbSeats: 3 }),
      })
      await firstOpponent.client.lobbies.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.lobbies.join.mutate({ gameId: createdGameId })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.player).toStrictEqual({ id: creator.account.id, color: PlayerColor.TURQUOISE, isReady: false })
      expect(playerView.opponents).toStrictEqual({
        [firstOpponent.account.id]: { id: firstOpponent.account.id, color: PlayerColor.PINK, isReady: false },
        [secondOpponent.account.id]: { id: secondOpponent.account.id, color: PlayerColor.YELLOW, isReady: false },
      })
    })

    integrationTest("should reject invalid game ids", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      const getPlayerView = player.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject anonymous game state reads", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getPlayerView = anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("updateActionSubmission", () => {
    integrationTest("should submit an action with valid planet targets", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      const homePlanet = initialPlayerView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)

      // Act
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildFleet.id,
          selectedTargets: { planet: homePlanet.id },
        }),
      })

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView.actions.find(({ id }) => id === buildFleet.id)?.selectedTargets).toStrictEqual({ planet: homePlanet.id })
    })

    integrationTest("should update only the submitting player's Action when players share stable Action IDs", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const opponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await opponent.client.lobbies.join.mutate({ gameId: createdGameId })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const creatorAction = creatorView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(creatorAction)

      const opponentView = await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const opponentAction = opponentView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(opponentAction)

      // Act
      await creator.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: creatorView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: creatorAction.id, selectedTargets: {} }),
      })

      // Assert
      expect(creatorAction.id).toBe(opponentAction.id)
      expect(
        (await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === creatorAction.id),
      ).toMatchObject({ selectedTargets: {} })
      expect(
        (await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === opponentAction.id),
      ).toMatchObject({ selectedTargets: null })
    })

    integrationTest("should submit and deselect multiple actions", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const gainFuel = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainFuel.id)
      const gainMetal = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
      Assert.isDefined(gainFuel)
      Assert.isDefined(gainMetal)

      // Act
      for (const action of [gainFuel, gainMetal]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: {} }),
        })
      }
      const selectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      for (const action of [gainFuel, gainMetal]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: null }),
        })
      }
      const deselectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const expectedSelectedActions = [
        {
          id: expect.any(String),
          actionDefinitionId: GainInfluence.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: WinTheGame.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainEnergy.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainFuel.id,
          selectedTargets: {},
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainMetal.id,
          selectedTargets: {},
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
      ]
      expect(selectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedSelectedActions))
      expect(selectedPlayerView.actions).toHaveLength(expectedSelectedActions.length)

      const expectedDeselectedActions = [
        {
          id: expect.any(String),
          actionDefinitionId: GainInfluence.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: WinTheGame.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainEnergy.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainFuel.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainMetal.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
      ]
      expect(deselectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedDeselectedActions))
      expect(deselectedPlayerView.actions).toHaveLength(expectedDeselectedActions.length)
    })

    integrationTest("should reject an action with invalid planet targets", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

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

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
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
      await expect(updateActionSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject setting an action after the turn deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
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
        data: { code: "BAD_REQUEST" },
      })
    })

    integrationTest("should reject an action the player cannot afford", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
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

    integrationTest("should reject an action that is not available to the player", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createLobbyConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
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

  // This test suite is often failing, but only in the CI. Not sure if it is hanging or just taking longer.
  // If we get timeouts on a 20s budget, this is definitely hanging and there's an issue running on the CI that we should address.
  describe("updateReadiness", { timeout: 20_000 }, () => {
    integrationTest.for([true, false])("should set the player readiness to %s", async (isReady, { db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.lobbies.join.mutate({ gameId: createdGameId }) // 2nd player to avoid turn processing on ready

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady }) // Making sure the status will change
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        player: {
          ...initialPlayerView.player,
          isReady,
        },
      })
    })

    integrationTest("should close the turn and submit for processing when all players are ready", async ({ db }) => {
      // Arrange
      const logger = Logger.get()
      const clock = new ControlledClock()
      const turnsRepository = new TurnsRepository({ db, logger })

      const apiServices = await createApiStub({ db, clock })
      using apiServer = new ApiServer(apiServices)
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.lobbies.join.mutate({ gameId: createdGameId })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithOnePlayerReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithAllPlayersReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const playerId = branded<PlayerId>(player.account.id)
      const initialPlayer = initialPlayerView.opponents[playerId]
      Assert.isDefined(initialPlayer)

      expect(playerViewWithOnePlayerReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })
      expect(playerViewWithAllPlayersReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        turnStatus: TurnStatus.AWAITING_PROCESSING,
        player: {
          ...initialPlayerView.player,
          isReady: true,
        },
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })

      const turnForProcessing = await apiServices.createTransaction(
        async (tx) => await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx),
      )
      expect(turnForProcessing).toStrictEqual<typeof turnForProcessing>(Result.Success(branded({ gameId: createdGameId, turn: 1 })))
    })

    integrationTest("should reject readiness for the wrong turn", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 0, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness past the deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({
          mapGenerationSeed: 1234,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
        }),
      })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: turnInterval })
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness for players not in the game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true }) // not in the game

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createLobbyConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })
  })
})
