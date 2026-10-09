import { Datetime, Time, UnitOfTime, branded } from "@guillaume-docquier/tools-ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { createTestGameConfigurationStub } from "shared/testing/GameConfiguration.stub.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import type { GamePlayerDto } from "#api/games/GameDetailsDto.ts"
import { MAX_NB_SEATS } from "#api/games/GameLimits.ts"
import type { RulesetSummaryDto } from "#api/games/RulesetSummaryDto.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"

const TEST_RULESET_SUMMARY: RulesetSummaryDto = {
  id: TestRuleset.id,
  name: TestRuleset.name,
  isDefault: TestRuleset.isDefault,
}

describe("games.router", () => {
  describe("getSummaries", () => {
    integrationTest("should get game summaries when anonymous", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const anonymous = await apiServer.createClient({ authenticated: false })

      const creator = await apiServer.createClient({ authenticated: true })
      const newGameSettings = createTestGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const getGameSummariesResult = await anonymous.client.games.getSummaries.query()

      // Assert
      expect(getGameSummariesResult).toStrictEqual<typeof getGameSummariesResult>([
        {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: false,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: newGameSettings.name,
          nbPlayers: 1,
          nbSeats: newGameSettings.nbSeats,
        },
      ])
    })

    integrationTest("should get game summaries when authenticated", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const creator = await apiServer.createClient({ authenticated: true })
      const joinedGameSettings = createTestGameConfigurationStub({ name: "Joined game" })
      const { createdGameId: joinedGameId } = await creator.client.games.create.mutate({ configuration: joinedGameSettings })

      const otherCreator = await apiServer.createClient({ authenticated: true })
      const notJoinedGameSettings = createTestGameConfigurationStub({ name: "Not joined game" })
      const { createdGameId: notJoinedGameId } = await otherCreator.client.games.create.mutate({ configuration: notJoinedGameSettings })

      // Act
      const getGameSummariesResult = await creator.client.games.getSummaries.query()

      // Assert
      expect(getGameSummariesResult).toStrictEqual<typeof getGameSummariesResult>([
        {
          id: notJoinedGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: false,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: notJoinedGameSettings.name,
          nbPlayers: 1,
          nbSeats: notJoinedGameSettings.nbSeats,
        },
        {
          id: joinedGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: true,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: joinedGameSettings.name,
          nbPlayers: 1,
          nbSeats: joinedGameSettings.nbSeats,
        },
      ])
    })
  })
  describe("startGame", () => {
    integrationTest("should reject starting a game as an account that has not joined", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const nonPlayer = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })

      // Act
      const startGame = nonPlayer.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
    })

    integrationTest("should generate a deterministic galaxy from the game's seed", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true, id: "7f80447c-442a-4229-8d52-39b675b3e80c" })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      await player.client.games.startGame.mutate({ gameId: createdGameId })
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

      const newGameSettings = createTestGameConfigurationStub({ turnIntervalSeconds: 60 })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await player.client.games.startGame.mutate({ gameId: createdGameId })
      const lobby = await player.client.games.getById.query({ gameId: createdGameId })
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

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: 3, mapGenerationSeed: 1234 }),
      })
      await firstOpponent.client.games.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.games.join.mutate({ gameId: createdGameId })

      // Act
      await creator.client.games.startGame.mutate({ gameId: createdGameId })
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

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Act
      const startGame = joiner.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject starting a game that has already started", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const startGame = creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject anonymous game start", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const startGame = anonymous.client.games.startGame.mutate({ gameId: 1 })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getCreationSettings", () => {
    integrationTest("should return backend-driven defaults and limits", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      const creationSettings = await player.client.games.getCreationSettings.query()

      // Assert
      expect(creationSettings).toStrictEqual<typeof creationSettings>({
        maxNbSeats: MAX_NB_SEATS,
        rulesets: [TEST_RULESET_SUMMARY],
      })
    })
  })

  describe("create", () => {
    integrationTest.for([0, UInt32.max])("should accept the UInt32 seed %i", async (mapGenerationSeed, { db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGameResult = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ mapGenerationSeed }),
      })

      // Assert
      expect(createGameResult).toStrictEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })
    })

    integrationTest.for([-1, UInt32.max + 1, 1.5])("should reject the invalid seed %i", async (mapGenerationSeed, { db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGame = creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub({ mapGenerationSeed }) })

      // Assert
      await expect(createGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject an unknown Ruleset", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGame = creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ rulesetId: "unknown" }),
      })

      // Assert
      await expect(createGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should create a game for the authenticated player", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createTestGameConfigurationStub()

      // Act
      const createGameResult = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createGameResult).toStrictEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })

      const createdGame = await creator.client.games.getById.query({ gameId: createGameResult.createdGameId })
      const expectedCreator: GamePlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }

      expect(createdGame).toStrictEqual<typeof createdGame>({
        id: createGameResult.createdGameId,
        createdAt: expect.any(String),
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        endedAt: null,
        startedAt: null,
        winnerAccountId: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false, // because already joined
        canLeave: false, // because creator
        canStart: true, // because creator
        canOpen: false, // because not started
      })
    })

    integrationTest("should create a one-seat game ready to start", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: 1 }),
      })

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.status).toBe(GameStatus.READY_TO_START)
    })

    integrationTest("should create a game with MAX_NB_SEATS seats", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.configuration.nbSeats).toBe(MAX_NB_SEATS)
    })

    integrationTest("should reject a game with MAX_NB_SEATS + 1 seats", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGame = creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: MAX_NB_SEATS + 1 }),
      })

      // Assert
      await expect(createGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject anonymous game creation", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const createGame = anonymous.client.games.create.mutate({
        configuration: createTestGameConfigurationStub(),
      })

      // Assert
      await expect(createGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getById", () => {
    integrationTest("should get a lobby by id when authenticated", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createTestGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await viewer.client.games.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: GamePlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true,
        canLeave: false,
        canStart: false,
        canOpen: false,
      })
    })

    integrationTest("should get a lobby by id anonymously", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const newGameSettings = createTestGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await anonymous.client.games.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: GamePlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: false,
        canOpen: false, // Because anonymous
      })
    })

    integrationTest("should only allow joined players to open a started game", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerLobby = await creator.client.games.getById.query({ gameId: createdGameId })
      const nonPlayerLobby = await viewer.client.games.getById.query({ gameId: createdGameId })
      const anonymousLobby = await anonymous.client.games.getById.query({ gameId: createdGameId })

      // Assert
      expect({
        player: { status: playerLobby.status, canOpen: playerLobby.canOpen },
        nonPlayer: { status: nonPlayerLobby.status, canOpen: nonPlayerLobby.canOpen },
        anonymous: { status: anonymousLobby.status, canOpen: anonymousLobby.canOpen },
      }).toStrictEqual({
        player: { status: GameStatus.IN_PROGRESS, canOpen: true },
        nonPlayer: { status: GameStatus.IN_PROGRESS, canOpen: false },
        anonymous: { status: GameStatus.IN_PROGRESS, canOpen: false },
      })
    })

    integrationTest("should return not found when getting a missing lobby by id", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getLobby = anonymous.client.games.getById.query({ gameId: 404 })

      // Assert
      await expect(getLobby).rejects.toMatchObject({ data: { code: "NOT_FOUND" } })
    })
  })

  describe("join", () => {
    integrationTest("should allocate high-contrast colors first in a small lobby", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const firstJoiner = await apiServer.createClient({ authenticated: true })
      const secondJoiner = await apiServer.createClient({ authenticated: true })
      const thirdJoiner = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: 4 }),
      })

      // Act
      await firstJoiner.client.games.join.mutate({ gameId: createdGameId })
      await secondJoiner.client.games.join.mutate({ gameId: createdGameId })
      await thirdJoiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      const colorsByPlayerId = new Map(lobby.players.map(({ id, color }) => [id, color]))
      expect(colorsByPlayerId.get(branded<PlayerId>(creator.account.id))).toBe(PlayerColor.TURQUOISE)
      expect(colorsByPlayerId.get(branded<PlayerId>(firstJoiner.account.id))).toBe(PlayerColor.PINK)
      expect(colorsByPlayerId.get(branded<PlayerId>(secondJoiner.account.id))).toBe(PlayerColor.YELLOW)
      expect(colorsByPlayerId.get(branded<PlayerId>(thirdJoiner.account.id))).toBe(PlayerColor.ORANGE)
    })

    integrationTest("should assign every player color in a maximum sized lobby", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Act
      await Promise.all(joiners.map(async (joiner) => await joiner.client.games.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    integrationTest("should assign every player color in a maximum sized lobby as players leave and rejoin", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      await Promise.all(joiners.map(async (joiner) => await joiner.client.games.join.mutate({ gameId: createdGameId })))

      // Act
      const leavers = joiners.slice(joiners.length / 2)

      await Promise.all(leavers.map(async (leaver) => await leaver.client.games.leave.mutate({ gameId: createdGameId })))

      await Promise.all(leavers.map(async (rejoiner) => await rejoiner.client.games.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    integrationTest("should join a game", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createTestGameConfigurationStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const joinedLobby = await joiner.client.games.getById.query({ gameId: createdGameId })
      const expectedCreator: GamePlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      const expectedJoiner: GamePlayerDto = {
        id: branded(joiner.account.id),
        alias: joiner.account.alias,
        color: PlayerColor.PINK,
      }

      expect(joinedLobby).toStrictEqual<typeof joinedLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator, expectedJoiner],
        status: GameStatus.READY_TO_START,
        canJoin: false,
        canLeave: true,
        canStart: false,
        canOpen: false,
      })
    })

    integrationTest("should reject joining a game that is full", async ({ db }) => {
      // Arrange
      const { api, accountsRepository } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: 2 }),
      })

      await player.client.games.join.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
    })

    integrationTest("should reject joining a game that has started", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    integrationTest("should successfully join a game the player is already in without joining twice", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createTestGameConfigurationStub({ nbSeats: 3 }),
      })
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Act
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
      expect(lobby.status).toBe(GameStatus.WAITING_FOR_PLAYERS)
    })

    integrationTest("should reject anonymous game join", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const joinGame = anonymous.client.games.join.mutate({ gameId: 1 })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("leave", () => {
    integrationTest("should leave a game", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createTestGameConfigurationStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      await leaver.client.games.join.mutate({ gameId: createdGameId })

      // Act
      await leaver.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      const leftLobby = await leaver.client.games.getById.query({ gameId: createdGameId })
      const expectedCreator: GamePlayerDto = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }

      expect(leftLobby).toStrictEqual<typeof leftLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
          ruleset: TEST_RULESET_SUMMARY,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true, // Because left
        canLeave: false, // Because left
        canStart: false, // Because not creator
        canOpen: false, // Because not joined
      })
    })

    integrationTest("should reject leaving a game that has started", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })
      await leaver.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const leaveGame = leaver.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject leaving a game as its creator", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })

      // Act
      const leaveGame = player.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should successfully leave a game the player has not joined", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const nonPlayer = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createTestGameConfigurationStub() })

      // Act
      await nonPlayer.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getById.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    integrationTest("should reject anonymous game leave", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const leaveGame = anonymous.client.games.leave.mutate({ gameId: 1 })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })
})
