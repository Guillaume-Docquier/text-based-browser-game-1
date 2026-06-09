import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { type CreateGameDto, type GameSummaryPlayerDto, GameSummaryStatus } from "#api/games/games.controller.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("games.router", () => {
  describe("create", () => {
    it("should create a game for the authenticated player", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "my new game",
        nbSeats: 43,
        tickIntervalSeconds: 420,
      }

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      // Assert
      expect(createGameResult).toEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })

      const createdGame = await trpcClient.client.games.getSummaryById.query({ gameId: createGameResult.createdGameId })
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(createdGame).toEqual<typeof createdGame>({
        game: {
          id: createGameResult.createdGameId,
          createdAt: expect.any(String),
          settings: {
            ...newGameSettings,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          endedAt: null,
          startedAt: null,
          winnerAccountId: null,
          creator,
          players: [creator],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: false, // because already joined
          canLeave: false, // because creator
          canStart: true, // because creator
        },
      })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.games.create.mutate({
          settings: {
            name: "my new game",
            nbSeats: 43,
            tickIntervalSeconds: 420,
          },
        }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getSummaries", () => {
    it("should get summaries anonymously", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "public game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = undefined

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: createdGameId,
            createdAt: expect.any(String),
            endedAt: null,
            winnerAccountId: null,
            settings: {
              ...newGameSettings,
              locked: false,
              starSystemGenerationSettings: {
                ...createDefaultStarSystemGenerationSettings(),
                seed: expect.any(Number),
              },
            },
            startedAt: null,
            creator,
            players: [creator],
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "joinable game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = viewerAccount

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: createdGameId,
            createdAt: expect.any(String),
            endedAt: null,
            winnerAccountId: null,
            settings: {
              ...newGameSettings,
              locked: false,
              starSystemGenerationSettings: {
                ...createDefaultStarSystemGenerationSettings(),
                seed: expect.any(Number),
              },
            },
            startedAt: null,
            creator,
            players: [creator],
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "specific game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = viewerAccount

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: createdGameId })

      // Assert
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          winnerAccountId: null,
          settings: {
            ...newGameSettings,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          startedAt: null,
          creator,
          players: [creator],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should get a summary by id anonymously", async () => {
      // Arrange

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "specific game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = undefined

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: createdGameId })

      // Assert
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          winnerAccountId: null,
          settings: {
            ...newGameSettings,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          startedAt: null,
          creator,
          players: [creator],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: false,
          canLeave: false,
          canStart: false,
        },
      })
    })

    it("should return not found when getting a missing summary by id", async () => {
      // Arrange
      const { api } = await createApiStub()
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const joinerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "join game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = joinerAccount

      // Act
      const joinGameResult = await trpcClient.client.games.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({ playerId: joinerAccount.id })

      const joinedGameSummary = await trpcClient.client.games.getSummaryById.query({ gameId: createdGameId })
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      const joiner: GameSummaryPlayerDto = { id: joinerAccount.id, alias: joinerAccount.alias }

      expect(joinedGameSummary).toEqual<typeof joinedGameSummary>({
        game: {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          winnerAccountId: null,
          settings: {
            ...newGameSettings,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          startedAt: null,
          creator,
          players: [creator, joiner],
          status: GameSummaryStatus.READY_TO_START,
          canJoin: false,
          canLeave: true,
          canStart: false,
        },
      })
    })

    it("should reject joining a game the player is already in", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: {
          name: "already joined game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      const { api } = await createApiStub()
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const leaverAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "leave game",
        nbSeats: 3,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      authService.account = leaverAccount
      await trpcClient.client.games.join.mutate({ gameId: createdGameId })

      // Act
      const leaveGameResult = await trpcClient.client.games.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>(true)

      const leftGameSummary = await trpcClient.client.games.getSummaryById.query({ gameId: createdGameId })
      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(leftGameSummary).toEqual<typeof leftGameSummary>({
        game: {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          winnerAccountId: null,
          settings: {
            ...newGameSettings,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          startedAt: null,
          creator,
          players: [creator],
          status: GameSummaryStatus.WAITING_FOR_PLAYERS,
          canJoin: true, // Because left
          canLeave: false, // Because left
          canStart: false, // Because not creator
        },
      })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: {
          name: "creator cannot leave game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      const { api } = await createApiStub()
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["settings"] = {
        name: "start game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.games.create.mutate({ settings: newGameSettings })

      // Act
      const startGameResult = await trpcClient.client.games.start.mutate({ gameId: createdGameId })

      // Assert

      const creator: GameSummaryPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(startGameResult).toEqual<typeof startGameResult>({
        startedGame: {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          winnerAccountId: null,
          settings: {
            ...newGameSettings,
            locked: true,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          startedAt: expect.any(String),
          creator,
          players: [creator],
          status: GameSummaryStatus.STARTED,
          canJoin: false, // Because started
          canLeave: false, // Because started
          canStart: false, // Because started
        },
      })
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: {
          name: "non creator cannot start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.account = account

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
