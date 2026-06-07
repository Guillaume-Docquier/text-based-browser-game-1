import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createNewAccountModelStub } from "#lib/db/accounts/NewAccountModel.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { GameSummaryStatus } from "#api/games/games.controller.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { Assert } from "@guillaume-docquier/tools-ts"

describe("games.router", () => {
  describe("create", () => {
    it("should create a game for the authenticated account", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub()))
      authService.account = account

      // Act
      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "my new game",
            nbSeats: 43,
            tickIntervalSeconds: 420,
          },
        },
      })

      // Assert
      expect(createGameResult).toEqual<typeof createGameResult>({
        newGame: {
          id: expect.any(Number),
          createdAt: expect.any(String),
          createdByAccountId: account.id,
          settings: {
            name: "my new game",
            nbSeats: 43,
            tickIntervalSeconds: 420,
            locked: false,
            starSystemGenerationSettings: {
              ...createDefaultStarSystemGenerationSettings(),
              seed: expect.any(Number),
            },
          },
          endedAt: null,
          startedAt: null,
          winnerPlayerId: null,
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
          newGame: {
            settings: {
              name: "my new game",
              nbSeats: 43,
              tickIntervalSeconds: 420,
            },
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

      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub()))
      authService.account = account

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "public game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = undefined

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            settings: newGame.settings,
            startedAt: null,
            creator: {
              id: account.id,
              alias: account.alias,
            },
            players: [
              {
                id: expect.any(String),
                alias: account.alias,
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

    it("should get summaries for an authenticated account who can join", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "joinable game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = account

      // Act
      const getSummariesResult = await trpcClient.client.games.getSummaries.query()

      // Assert
      expect(getSummariesResult).toEqual<typeof getSummariesResult>({
        games: [
          {
            id: newGame.id,
            createdAt: expect.any(String),
            endedAt: null,
            winnerPlayerId: null,
            settings: newGame.settings,
            startedAt: null,
            creator: {
              id: creator.id,
              alias: creator.alias,
            },
            players: [
              {
                id: expect.any(String),
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "specific game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = account

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          settings: newGame.settings,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: expect.any(String),
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

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "specific game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = undefined

      // Act
      const getSummaryByIdResult = await trpcClient.client.games.getSummaryById.query({ gameId: newGame.id })

      // Assert
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        game: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          settings: newGame.settings,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: expect.any(String),
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

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "join game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = account

      // Act
      const joinGameResult = await trpcClient.client.games.join.mutate({ gameId: newGame.id })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({
        joinedGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          settings: newGame.settings,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: expect.any(String),
              alias: creator.alias,
            },
            {
              id: expect.any(String),
              alias: account.alias,
            },
          ],
          status: GameSummaryStatus.READY_TO_START,
          canJoin: false,
          canLeave: true,
          canStart: false,
        },
      })
    })

    it("should reject joining a game the account is already in", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.create(createNewAccountModelStub()))

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "already joined game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.join.mutate({ gameId: newGame.id })).rejects.toMatchObject({
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

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "leave game",
            nbSeats: 3,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = account
      await trpcClient.client.games.join.mutate({ gameId: newGame.id })

      // Act
      const leaveGameResult = await trpcClient.client.games.leave.mutate({ gameId: newGame.id })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>({
        leftGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          settings: newGame.settings,
          startedAt: null,
          creator: {
            id: creator.id,
            alias: creator.alias,
          },
          players: [
            {
              id: expect.any(String),
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

    it("should create a new player id when an account rejoins", async () => {
      // Arrange
      const { api, authService, accountsRepository, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator
      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: { name: "rejoin game", nbSeats: 3, tickIntervalSeconds: 60 },
        },
      })

      authService.account = account
      await trpcClient.client.games.join.mutate({ gameId: newGame.id })
      const firstPlayer = extractSuccess(await playersRepository.getByGameIdAndAccountId({ gameId: newGame.id, accountId: account.id }))
      Assert.isDefined(firstPlayer)
      await trpcClient.client.games.leave.mutate({ gameId: newGame.id })

      // Act
      await trpcClient.client.games.join.mutate({ gameId: newGame.id })
      const secondPlayer = extractSuccess(await playersRepository.getByGameIdAndAccountId({ gameId: newGame.id, accountId: account.id }))
      Assert.isDefined(secondPlayer)

      // Assert
      expect(secondPlayer.id).not.toBe(firstPlayer.id)
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.create(createNewAccountModelStub()))

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "creator cannot leave game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      // Act & Assert
      await expect(trpcClient.client.games.leave.mutate({ gameId: newGame.id })).rejects.toMatchObject({
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

      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub()))
      authService.account = account

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "start game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      // Act
      const startGameResult = await trpcClient.client.games.start.mutate({ gameId: newGame.id })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({
        startedGame: {
          id: newGame.id,
          createdAt: expect.any(String),
          endedAt: null,
          winnerPlayerId: null,
          settings: {
            ...newGame.settings,
            locked: true,
          },
          startedAt: expect.any(String),
          creator: {
            id: account.id,
            alias: account.alias,
          },
          players: [
            {
              id: expect.any(String),
              alias: account.alias,
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
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.create(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: {
            name: "non creator cannot start game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
          },
        },
      })

      authService.account = account

      // Act & Assert
      await expect(trpcClient.client.games.start.mutate({ gameId: newGame.id })).rejects.toMatchObject({
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
