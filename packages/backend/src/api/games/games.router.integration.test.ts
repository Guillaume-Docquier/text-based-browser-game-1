import { Datetime, Time, UnitOfTime, branded, UInt32 } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { MAX_NB_SEATS } from "shared/domain/games/GameConfiguration.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { Player } from "shared/domain/players/Player.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { CreateGameError, CreateGameErrorResponses } from "#api/games/createGame.error.ts"
import { GetGameByIdError, GetGameByIdErrorResponses } from "#api/games/getGameById.error.ts"
import { JoinGameError, JoinGameErrorResponses } from "#api/games/joinGame.error.ts"
import { LeaveGameError, LeaveGameErrorResponses } from "#api/games/leaveGame.error.ts"
import { StartGameError, StartGameErrorResponses } from "#api/games/startGame.error.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"

describe("games.router", () => {
  describe("getListings", () => {
    it("should get game listings when anonymous", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))

      const anonymous = await apiServer.createClient({ authenticated: false })

      const creator = await apiServer.createClient({ authenticated: true })
      const newGameSettings = createGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const getGameListingsResult = await anonymous.client.games.getListings.query()

      // Assert
      expect(getGameListingsResult).toStrictEqual<typeof getGameListingsResult>([
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

    it("should get game listings when authenticated", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))

      const creator = await apiServer.createClient({ authenticated: true })
      const joinedGameSettings = createGameConfigurationStub({ name: "Joined game" })
      const { createdGameId: joinedGameId } = await creator.client.games.create.mutate({ configuration: joinedGameSettings })

      const otherCreator = await apiServer.createClient({ authenticated: true })
      const notJoinedGameSettings = createGameConfigurationStub({ name: "Not joined game" })
      const { createdGameId: notJoinedGameId } = await otherCreator.client.games.create.mutate({ configuration: notJoinedGameSettings })

      // Act
      const getGameListingsResult = await creator.client.games.getListings.query()

      // Assert
      expect(getGameListingsResult).toStrictEqual<typeof getGameListingsResult>([
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
    it("should meet STRT-0002 When a match starts, each participating player receives the configured starting balance of 100 credits, including the only player in a solo match.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using server = new ApiServer(await createApiStub({ db }))
      const alice = await server.createClient({ authenticated: true })
      const bob = await server.createClient({ authenticated: true })
      const { createdGameId: solo } = await alice.client.games.create.mutate({ configuration: createGameConfigurationStub({ nbSeats: 2 }) })
      const { createdGameId: multiplayer } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2 }),
      })
      await bob.client.games.join.mutate({ gameId: multiplayer })

      // Act
      await alice.client.games.startGame.mutate({ gameId: solo })
      await alice.client.games.startGame.mutate({ gameId: multiplayer })
      const soloView = await alice.client.gameplay.getPlayerView.query({ gameId: solo })
      const aliceView = await alice.client.gameplay.getPlayerView.query({ gameId: multiplayer })
      const bobView = await bob.client.gameplay.getPlayerView.query({ gameId: multiplayer })

      // Assert
      expect([soloView.player.creditBalance, aliceView.player.creditBalance, bobView.player.creditBalance]).toStrictEqual([100, 100, 100])
    })

    it("should meet STRT-0004 When a match starts, each participant owns exactly one transport stationed at their home planet with no cargo and no order.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using server = new ApiServer(await createApiStub({ db }))
      const creator = await server.createClient({ authenticated: true })
      const configuration = createGameConfigurationStub({ nbSeats: MAX_NB_SEATS, mapGenerationSeed: 1234 })
      const { createdGameId: solo } = await creator.client.games.create.mutate({ configuration })
      const { createdGameId: full } = await creator.client.games.create.mutate({ configuration })
      for (let index = 1; index < MAX_NB_SEATS; index++) {
        const participant = await server.createClient({ authenticated: true })
        await participant.client.games.join.mutate({ gameId: full })
      }

      // Act
      await creator.client.games.startGame.mutate({ gameId: solo })
      await creator.client.games.startGame.mutate({ gameId: full })

      // Assert
      for (const [gameId, players] of [
        [solo, 1],
        [full, MAX_NB_SEATS],
      ] as const) {
        const view = await creator.client.gameplay.getPlayerView.query({ gameId })
        const homes = view.galaxy.systems.flatMap((system) => system.planets).filter((planet) => planet.ownerPlayerId !== null)
        expect(view.ships).toHaveLength(players)
        expect(new Set(view.ships.map((ship) => ship.id)).size).toBe(players)
        expect(homes).toHaveLength(players)
        for (const home of homes) {
          expect(view.ships.filter((ship) => ship.ownerPlayerId === home.ownerPlayerId)).toStrictEqual([
            expect.objectContaining({ type: "TRANSPORT", planetId: home.id, cargo: [], order: null }),
          ])
        }
      }
    })

    it("should meet STRT-0003 When a match starts, each home has one operating trade center on the first free surface hex alongside its command center.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using server = new ApiServer(await createApiStub({ db }))
      const alice = await server.createClient({ authenticated: true })
      const bob = await server.createClient({ authenticated: true })
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2 }),
      })
      await bob.client.games.join.mutate({ gameId })

      // Act
      await alice.client.games.startGame.mutate({ gameId })
      const view = await alice.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      const homes = view.galaxy.systems.flatMap(({ planets }) => planets).filter(({ ownerPlayerId }) => ownerPlayerId !== null)
      expect(homes).toHaveLength(2)
      expect(view.buildings).toHaveLength(4)
      for (const home of homes) {
        expect(view.buildings.filter(({ planetId }) => planetId === home.id)).toStrictEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "COMMAND_CENTER", site: 0 }),
            expect.objectContaining({ type: "TRADE_CENTER", site: 1 }),
          ]),
        )
      }
    })

    it("should meet STRT-0001 When a match starts, each owned home planet has exactly one persisted command center on its center hex, and every unowned planet starts with an empty surface.", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using server = new ApiServer(await createApiStub({ db }))
      const alice = await server.createClient({ authenticated: true })
      const bob = await server.createClient({ authenticated: true })
      const { createdGameId: gameId } = await alice.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2, mapGenerationSeed: 1234 }),
      })
      await bob.client.games.join.mutate({ gameId })

      // Act
      await alice.client.games.startGame.mutate({ gameId })
      const view = await bob.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      const homes = view.galaxy.systems.flatMap(({ planets }) => planets).filter((planet) => planet.ownerPlayerId !== null)
      expect(homes).toHaveLength(2)
      expect(view.buildings.every((building) => homes.some((home) => home.id === building.planetId))).toBe(true)
      const centers = view.buildings.filter((building) => building.type === "COMMAND_CENTER")
      expect(new Set(centers.map(({ id }) => id)).size).toBe(2)
      expect(
        centers.map(({ planetId, type, site }) => ({ planetId, type, site })).toSorted((a, b) => a.planetId.localeCompare(b.planetId)),
      ).toStrictEqual(
        homes.map(({ id }) => ({ planetId: id, type: "COMMAND_CENTER", site: 0 })).toSorted((a, b) => a.planetId.localeCompare(b.planetId)),
      )
    })

    it("should reject starting a game as an account that has not joined", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const nonPlayer = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })

      // Act
      const startGame = nonPlayer.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
    })

    it("should generate a deterministic galaxy from the game's seed", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true, id: "7f80447c-442a-4229-8d52-39b675b3e80c" })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      // Act
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.galaxy.systems.length).toBeGreaterThan(500)
      expect(playerView.galaxy.systems.flatMap(({ planets }) => planets).length).toBeGreaterThan(1500)
      expect(
        playerView.galaxy.systems.flatMap((system) => system.planets).find(({ id }) => id === "37c2b7b7-e1b1-584c-9043-aaab03ac3808"),
      ).toStrictEqual({
        coordinates: "63:50:40",
        x: 30.754045402421188,
        y: 65.12758196335155,
        id: "37c2b7b7-e1b1-584c-9043-aaab03ac3808",
        ownerPlayerId: null,
        name: "planet 272683",
        biome: PlanetBiome.METALLIC,
        size: PlanetSize.MEDIUM,
        metalProduction: 4,
        remainingMetalDeposit: 19,
        area: 4,
      })

      const allStars = playerView.galaxy.systems.map(({ star }) => star)
      expect(new Set(allStars.map((star) => star.coordinates)).size).toStrictEqual(allStars.length)
      expect(new Set(allStars.map((star) => star.id)).size).toStrictEqual(allStars.length)

      const allPlanets = playerView.galaxy.systems.flatMap(({ planets }) => planets)
      expect(new Set(allPlanets.map((planet) => planet.coordinates)).size).toStrictEqual(allPlanets.length)
      expect(new Set(allPlanets.map((planet) => planet.id)).size).toStrictEqual(allPlanets.length)

      expect(playerView.galaxy).toMatchSnapshot()
    })

    it("should start a game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationStub({ turnIntervalSeconds: 60 })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await player.client.games.startGame.mutate({ gameId: createdGameId })
      const lobby = await player.client.games.getDetails.query({ gameId: createdGameId })
      const turnState = await readTurnState(player.client, createdGameId)

      // Assert
      expect(startGameResult).toBeUndefined()
      expect(lobby.status).toBe(GameStatus.IN_PROGRESS)
      expect(lobby.startedAt).toBe(clock.now().toISOString())
      expect(turnState.turnEndsAt).toBe(
        Datetime.increment({
          date: clock.now(),
          time: Time.create(newGameSettings.turnIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
      )
    })

    it("should assign one unique Home Planet to every player", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))

      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 3, mapGenerationSeed: 1234 }),
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

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Act
      const startGame = joiner.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchErrorResponse(StartGameErrorResponses[StartGameError.NOT_GAME_CREATOR])
    })

    it("should reject starting a game that has already started", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const startGame = creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Assert
      await expect(startGame).rejects.toMatchErrorResponse(StartGameErrorResponses[StartGameError.INVALID_GAME_STATUS])
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const startGame = anonymous.client.games.startGame.mutate({ gameId: 1 })

      // Assert
      await expect(startGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("create", () => {
    it.each([0, UInt32.max])("should accept the UInt32 seed %i", async (mapGenerationSeed) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGameResult = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed }),
      })

      // Assert
      expect(createGameResult).toStrictEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })
    })

    it.each([-1, UInt32.max + 1, 1.5])("should reject the invalid seed %i", async (mapGenerationSeed) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGame = creator.client.games.create.mutate({ configuration: createGameConfigurationStub({ mapGenerationSeed }) })

      // Assert
      await expect(createGame).rejects.toMatchErrorResponse(CreateGameErrorResponses[CreateGameError.INVALID_MAP_SEED])
    })

    it("should create a game for the authenticated player", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationStub()

      // Act
      const createGameResult = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createGameResult).toStrictEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })

      const createdGame = await creator.client.games.getDetails.query({ gameId: createGameResult.createdGameId })
      const expectedCreator: Player = {
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
        },
        endedAt: null,
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: true,
        canOpen: false,
      })
    })

    it("should create a one-seat game ready to start", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 1 }),
      })

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.status).toBe(GameStatus.READY_TO_START)
    })

    it("should create a game with MAX_NB_SEATS seats", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.configuration.nbSeats).toBe(MAX_NB_SEATS)
    })

    it("should reject a game with MAX_NB_SEATS + 1 seats", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      // Act
      const createGame = creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: MAX_NB_SEATS + 1 }),
      })

      // Assert
      await expect(createGame).rejects.toMatchErrorResponse(CreateGameErrorResponses[CreateGameError.TOO_MANY_SEATS])
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const createGame = anonymous.client.games.create.mutate({
        configuration: createGameConfigurationStub(),
      })

      // Assert
      await expect(createGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("getById", () => {
    it("should get a lobby by id when authenticated", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await viewer.client.games.getDetails.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: Player = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
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

    it("should get a lobby by id anonymously", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const newGameSettings = createGameConfigurationStub()
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await anonymous.client.games.getDetails.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: Player = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      expect(lobby).toStrictEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
        },
        startedAt: null,
        creator: expectedCreator,
        players: [expectedCreator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: false,
        canOpen: false,
      })
    })

    it("should only allow joined players to open a started game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerLobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      const nonPlayerLobby = await viewer.client.games.getDetails.query({ gameId: createdGameId })
      const anonymousLobby = await anonymous.client.games.getDetails.query({ gameId: createdGameId })

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

    it("should return not found when getting a missing lobby by id", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getLobby = anonymous.client.games.getDetails.query({ gameId: 404 })

      // Assert
      await expect(getLobby).rejects.toMatchErrorResponse(GetGameByIdErrorResponses[GetGameByIdError.GAME_NOT_FOUND])
    })
  })

  describe("join", () => {
    it("should allocate high-contrast colors first in a small lobby", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const firstJoiner = await apiServer.createClient({ authenticated: true })
      const secondJoiner = await apiServer.createClient({ authenticated: true })
      const thirdJoiner = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 4 }),
      })

      // Act
      await firstJoiner.client.games.join.mutate({ gameId: createdGameId })
      await secondJoiner.client.games.join.mutate({ gameId: createdGameId })
      await thirdJoiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      const colorsByPlayerId = new Map(lobby.players.map(({ id, color }) => [id, color]))
      expect(colorsByPlayerId.get(branded<PlayerId>(creator.account.id))).toBe(PlayerColor.TURQUOISE)
      expect(colorsByPlayerId.get(branded<PlayerId>(firstJoiner.account.id))).toBe(PlayerColor.PINK)
      expect(colorsByPlayerId.get(branded<PlayerId>(secondJoiner.account.id))).toBe(PlayerColor.YELLOW)
      expect(colorsByPlayerId.get(branded<PlayerId>(thirdJoiner.account.id))).toBe(PlayerColor.ORANGE)
    })

    it("should assign every player color in a maximum sized lobby", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      // Act
      await Promise.all(joiners.map(async (joiner) => await joiner.client.games.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    it("should assign every player color in a maximum sized lobby as players leave and rejoin", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiners = await Promise.all(
        Array.from({ length: MAX_NB_SEATS - 1 }, async () => await apiServer.createClient({ authenticated: true })),
      )
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: MAX_NB_SEATS }),
      })

      await Promise.all(joiners.map(async (joiner) => await joiner.client.games.join.mutate({ gameId: createdGameId })))

      // Act
      const leavers = joiners.slice(joiners.length / 2)

      await Promise.all(leavers.map(async (leaver) => await leaver.client.games.leave.mutate({ gameId: createdGameId })))

      await Promise.all(leavers.map(async (rejoiner) => await rejoiner.client.games.join.mutate({ gameId: createdGameId })))

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(new Set(lobby.players.map(({ color }) => color))).toStrictEqual(new Set(Object.values(PlayerColor)))
    })

    it("should join a game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      // Act
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const joinedLobby = await joiner.client.games.getDetails.query({ gameId: createdGameId })
      const expectedCreator: Player = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }
      const expectedJoiner: Player = {
        id: branded(joiner.account.id),
        alias: joiner.account.alias,
        color: PlayerColor.PINK,
      }

      expect(joinedLobby).toStrictEqual<typeof joinedLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
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

    it("should reject joining a game that is full", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const { api, accountsRepository } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 2 }),
      })

      await player.client.games.join.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchErrorResponse(JoinGameErrorResponses[JoinGameError.LOBBY_FULL])

      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
    })

    it("should reject joining a game that has started", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const joinGame = joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      await expect(joinGame).rejects.toMatchErrorResponse(JoinGameErrorResponses[JoinGameError.GAME_ALREADY_STARTED])

      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    it("should successfully join a game the player is already in without joining twice", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 3 }),
      })
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Act
      await joiner.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(2)
      expect(lobby.status).toBe(GameStatus.WAITING_FOR_PLAYERS)
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const joinGame = anonymous.client.games.join.mutate({ gameId: 1 })

      // Assert
      await expect(joinGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })

  describe("leave", () => {
    it("should leave a game", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.games.create.mutate({ configuration: newGameSettings })

      await leaver.client.games.join.mutate({ gameId: createdGameId })

      // Act
      await leaver.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      const leftLobby = await leaver.client.games.getDetails.query({ gameId: createdGameId })
      const expectedCreator: Player = {
        id: branded(creator.account.id),
        alias: creator.account.alias,
        color: PlayerColor.TURQUOISE,
      }

      expect(leftLobby).toStrictEqual<typeof leftLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        configuration: {
          name: newGameSettings.name,
          nbSeats: newGameSettings.nbSeats,
          turnIntervalSeconds: newGameSettings.turnIntervalSeconds,
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

    it("should reject leaving a game that has started", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await leaver.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const leaveGame = leaver.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchErrorResponse(LeaveGameErrorResponses[LeaveGameError.GAME_ALREADY_STARTED])
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })

      // Act
      const leaveGame = player.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      await expect(leaveGame).rejects.toMatchErrorResponse(LeaveGameErrorResponses[LeaveGameError.CREATOR_CANNOT_LEAVE])
    })

    it("should successfully leave a game the player has not joined", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const nonPlayer = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })

      // Act
      await nonPlayer.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      const lobby = await creator.client.games.getDetails.query({ gameId: createdGameId })
      expect(lobby.players).toHaveLength(1)
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const leaveGame = anonymous.client.games.leave.mutate({ gameId: 1 })

      // Assert
      await expect(leaveGame).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })
})
