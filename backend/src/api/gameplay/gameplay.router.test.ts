import { Assert, Datetime, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { createActionSubmissionStub } from "#lib/rules-engine/action-submission/ActionSubmission.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { StandardRuleset } from "#lib/rulesets/standard/StandardRuleset.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    using apiServer = new ApiServer(await createApiStub())
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayer.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getCurrentAction.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(
      nonPlayer.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: createActionSubmissionStub({ id: "unavailable-action" }),
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("start", () => {
    it("should generate a deterministic galaxy from the game's seed", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      // quick sanity checks
      expect(playerView.galaxy.systems.length).toBeGreaterThan(500) // enough systems are generated
      expect(playerView.galaxy.systems.flatMap(({ planets }) => planets).length).toBeGreaterThan(1500) // enough planets are generated
      expect(playerView.galaxy.systems[1]?.planets[1]).toEqual({
        coordinates: "44:76:35", // coordinates make sense
        x: 46.42101792976603,
        y: 47.21423492967076,
        id: expect.any(Number),
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
      expect(new Set(allStars.map((star) => star.coordinates)).size).toEqual(allStars.length) // unique coordinates

      const allPlanets = playerView.galaxy.systems.flatMap(({ planets }) => planets)
      expect(new Set(allPlanets.map((planet) => planet.coordinates)).size).toEqual(allPlanets.length) // unique coordinates

      expect(playerView.galaxy).toMatchSnapshot()
    })

    it("should start a game", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({ nextTurnAt: expect.any(String) }) // trpc serializes the date to string
      expect(new Date(startGameResult.nextTurnAt).toString()).not.toBe("Invalid Date")
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(joiner.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject starting a game that has already started", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(creator.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.startGame.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createGameConfigurationDtoStub()
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: gameConfiguration })

      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const getByIdResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameId: createdGameId,
        player: { id: player.account.id, color: PlayerColor.WHITE, ready: false },
        opponents: {},
        galaxy: expect.any(Object), // Verified by the snapshot test
        turn: 0,
        nextTurnAt: Datetime.increment({
          date: clock.now(),
          time: Time.create(gameConfiguration.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
        resources: createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 3, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
        ruleset: StandardRuleset,
        availableActions: [
          {
            id: expect.any(String),
            actionDefinitionId: GainInfluence.id,
            targets: { self: player.account.id },
            canAfford: true,
          },
          {
            id: expect.any(String),
            actionDefinitionId: WinTheGame.id,
            targets: { self: player.account.id },
            canAfford: false,
          },
          {
            id: expect.any(String),
            actionDefinitionId: GainEnergy.id,
            targets: { self: player.account.id },
            canAfford: true,
          },
          {
            id: expect.any(String),
            actionDefinitionId: GainFuel.id,
            targets: { self: player.account.id },
            canAfford: true,
          },
          {
            id: expect.any(String),
            actionDefinitionId: GainMetal.id,
            targets: { self: player.account.id },
            canAfford: true,
          },
        ],
      })
    })

    it("should expose uncommitted resources and use them to determine Action affordability", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const extractMetal = initialPlayerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
      Assert.isDefined(extractMetal)

      await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        actionSubmission: extractMetal,
      })

      // Act
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const generatePower = playerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
      Assert.isDefined(generatePower)

      // Assert
      expect(playerView.resources).toEqual<typeof playerView.resources>(
        createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 2, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
        }),
      )
      expect(generatePower.canAfford).toBe(false)
    })

    it("should expose the current player and every opponent with their colors", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ nbSeats: 3 }),
      })
      await firstOpponent.client.lobbies.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.lobbies.join.mutate({ gameId: createdGameId })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await firstOpponent.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })

      // Act
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.player).toEqual({ id: creator.account.id, color: PlayerColor.WHITE, ready: false })
      expect(playerView.opponents).toEqual({
        [firstOpponent.account.id]: { id: firstOpponent.account.id, color: PlayerColor.RED, ready: true },
        [secondOpponent.account.id]: { id: secondOpponent.account.id, color: PlayerColor.BLUE, ready: false },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      await expect(player.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("setReady", () => {
    it("should lock the turn when all players are ready", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ nbSeats: 2 }),
      })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await creator.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })

      // Act
      await joiner.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })
      const unreadyError = await joiner.client.gameplay.setReady
        .mutate({ gameId: createdGameId, ready: false })
        .catch((error: unknown) => error)
      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      expect(unreadyError).toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(lobby).toMatchObject({ status: GameStatus.AWAITING_PROCESSING, canOpen: true })
    })
  })

  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player and override server-owned targets", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, accountsRepository } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)
      // Act
      const setCurrentActionResult = await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: {
          ...makeMoreMoney,
          targets: { self: "not self" },
        },
      })
      const getCurrentActionResult = await player.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
        action: {
          id: makeMoreMoney.id,
          actionDefinitionId: GainInfluence.id,
          targets: { self: player.account.id },
        },
      })
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>(setCurrentActionResult)
    })

    it("should reject setting an action for a stale turn", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)

      // Act & Assert
      await expect(
        player.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          turn: 1,
          actionSubmission: makeMoreMoney,
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject an action the player cannot afford", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const winTheGame = playerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === WinTheGame.id)
      Assert.isDefined(winTheGame)

      // Act
      const setActionPromise = player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: winTheGame,
      })

      // Assert
      await expect(setActionPromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should lock the current action while ready and allow changes after becoming unready", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })
      const otherPlayer = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ nbSeats: 2 }),
      })
      await otherPlayer.client.lobbies.join.mutate({ gameId: createdGameId })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const action = playerView.availableActions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(action)
      await player.client.gameplay.setCurrentAction.mutate({ gameId: createdGameId, turn: playerView.turn, actionSubmission: action })
      await player.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: true })

      // Act
      const lockedActionChange = player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        actionSubmission: null,
      })

      // Assert
      await expect(lockedActionChange).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      // Act
      await player.client.gameplay.setReady.mutate({ gameId: createdGameId, ready: false })
      const clearedAction = await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        actionSubmission: null,
      })

      // Assert
      expect(clearedAction).toEqual({ action: null })
    })
  })

  describe("getCurrentAction", () => {
    it("should get the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, accountsRepository } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub(),
      })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      // Act
      const getCurrentActionResult = await player.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
