import { Logger, type Success } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { PlayersRepository, type PlayerRow } from "#lib/db/players/players.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { GameSummaryStatus } from "#api/games/games.controller.ts"

describe("games.router", () => {
  describe("create", () => {
    it("should create a game for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "my new game",
          nbSeats: 43,
          tickIntervalSeconds: 420,
        },
      })

      // Assert
      expect(createGameResult).toEqual<typeof createGameResult>({
        newGame: {
          id: expect.any(Number),
          createdAt: expect.any(String),
          createdByPlayerId: player.id,
          name: "my new game",
          nbSeats: 43,
          tickIntervalSeconds: 420,
          endedAt: null,
          startedAt: null,
          winnerPlayerId: null,
        },
      })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.games.create.mutate({ newGame: { name: "my new game", nbSeats: 43, tickIntervalSeconds: 420 } }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getSummaries", () => {
    it("should get summaries anonymously", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "public game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = undefined

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: createGameResult.newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            name: "public game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            startedAt: null,
            creator: {
              id: player.id,
              alias: player.alias,
            },
            players: [
              {
                id: player.id,
                alias: player.alias,
              },
            ],
            status: GameSummaryStatus.WAITING_FOR_PLAYERS,
            canJoin: false, // because anonymous
            canLeave: false, // because not in the game
            canStart: false, // because not the creator
          },
        ],
      })
    })

    it("should get summaries for an authenticated player who can join", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)
      const player = ((await playersRepository.insert(
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
      )) as Success<PlayerRow>).value

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "joinable game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = player

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: createGameResult.newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            name: "joinable game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            startedAt: null,
            creator: {
              id: creator.id,
              alias: creator.alias,
            },
            players: [
              {
                id: creator.id,
                alias: creator.alias,
              },
            ],
            status: GameSummaryStatus.WAITING_FOR_PLAYERS,
            canJoin: true, // because not in the game
            canLeave: false, // because not in the game
            canStart: false, // because not the creator
          },
        ],
      })
    })
  })

  describe("getSummaryById", () => {
    it("should get a summary by id when authenticated", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)
      const player = ((await playersRepository.insert(
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
      )) as Success<PlayerRow>).value

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = player

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: createGameResult.newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should get a summary by id anonymously", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = undefined

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: createGameResult.newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "specific game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: false,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should return not found when getting a missing summary by id", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.getSummaryById.query({ gameId: 404 })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })

  describe("join", () => {
    it("should join a game", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)
      const player = ((await playersRepository.insert(
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
      )) as Success<PlayerRow>).value

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "join game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = player

      // Act
      const joinGameResult = await trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({
        joinedGame: {
          id: createGameResult.newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "join game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
            {
              id: player.id,
              alias: player.alias,
            },
          ],
          status: GameSummaryStatus.READY_TO_START,
          canJoin: false,
          canLeave: true,
          canStart: false,
        },
      })
    })

    it("should reject joining a game the player is already in", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "already joined game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("leave", () => {
    it("should leave a game", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)
      const player = ((await playersRepository.insert(
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
      )) as Success<PlayerRow>).value

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "leave game",
          nbSeats: 3,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = player
      await trpcClient.client.games.join.mutate({ gameId: createGameResult.newGame.id })

      // Act
      const leaveGameResult = await trpcClient.client.games.leave.mutate({ gameId: createGameResult.newGame.id })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>({
        leftGame: {
          id: createGameResult.newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "leave game",
          nbSeats: 3,
          tickIntervalSeconds: 60,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: creator.id,
              alias: creator.alias,
            },
          ],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "creator cannot leave game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act
      const startGameResult = await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({
        startedGame: {
          id: createGameResult.newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          name: "start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          startedAt: expect.any(String),
          creator: {
            id: player.id,
            alias: player.alias,
          },
          players: [
            {
              id: player.id,
              alias: player.alias,
            },
          ],
          status: GameSummaryStatus.STARTED,
          canJoin: false,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const creator = ((await playersRepository.insert(createPlayerRowInsertStub({ alias: "Creator" })) as Success<PlayerRow>).value)
      const player = ((await playersRepository.insert(
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Player 2" }),
      )) as Success<PlayerRow>).value

      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "non creator cannot start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.player = player

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
