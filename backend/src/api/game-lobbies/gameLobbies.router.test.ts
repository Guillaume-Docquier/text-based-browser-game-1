import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { type CreateGameDto, type GameLobbyPlayerDto, GameLobbyStatus } from "#api/game-lobbies/gameLobbies.controller.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gameLobbies.router", () => {
  describe("create", () => {
    it("should create a game for the authenticated player", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["configuration"] = {
        name: "my new game",
        nbSeats: 43,
        tickIntervalSeconds: 420,
      }

      // Act
      const createGameResult = await trpcClient.client.gameLobbies.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createGameResult).toEqual<typeof createGameResult>({ createdGameId: expect.any(Number) })

      const createdGame = await trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: createGameResult.createdGameId })
      const creator: GameLobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(createdGame).toEqual<typeof createdGame>({
        id: createGameResult.createdGameId,
        createdAt: expect.any(String),
        configuration: {
          ...newGameSettings,
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
        status: GameLobbyStatus.WAITING_FOR_PLAYERS,
        canJoin: false, // because already joined
        canLeave: false, // because creator
        canStart: true, // because creator
      })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.gameLobbies.create.mutate({
          configuration: {
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

  describe("getSummaryById", () => {
    it("should get a summary by id when authenticated", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["configuration"] = {
        name: "specific game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({ configuration: newGameSettings })

      authService.account = viewerAccount

      // Act
      const getSummaryByIdResult = await trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: createdGameId })

      // Assert
      const creator: GameLobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          ...newGameSettings,
          starSystemGenerationSettings: {
            ...createDefaultStarSystemGenerationSettings(),
            seed: expect.any(Number),
          },
        },
        startedAt: null,
        creator,
        players: [creator],
        status: GameLobbyStatus.WAITING_FOR_PLAYERS,
        canJoin: true,
        canLeave: false,
        canStart: false,
      })
    })

    it("should get a summary by id anonymously", async () => {
      // Arrange

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      authService.account = creatorAccount

      const newGameSettings: CreateGameDto["configuration"] = {
        name: "specific game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({ configuration: newGameSettings })

      authService.account = undefined

      // Act
      const getSummaryByIdResult = await trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: createdGameId })

      // Assert
      const creator: GameLobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getSummaryByIdResult).toEqual<typeof getSummaryByIdResult>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          ...newGameSettings,
          starSystemGenerationSettings: {
            ...createDefaultStarSystemGenerationSettings(),
            seed: expect.any(Number),
          },
        },
        startedAt: null,
        creator,
        players: [creator],
        status: GameLobbyStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: false,
      })
    })

    it("should return not found when getting a missing summary by id", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: 404 })).rejects.toMatchObject({
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

      const newGameSettings: CreateGameDto["configuration"] = {
        name: "join game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({ configuration: newGameSettings })

      authService.account = joinerAccount

      // Act
      const joinGameResult = await trpcClient.client.gameLobbies.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({ playerId: joinerAccount.id })

      const joinedGameSummary = await trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: createdGameId })
      const creator: GameLobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      const joiner: GameLobbyPlayerDto = { id: joinerAccount.id, alias: joinerAccount.alias }

      expect(joinedGameSummary).toEqual<typeof joinedGameSummary>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          ...newGameSettings,
          starSystemGenerationSettings: {
            ...createDefaultStarSystemGenerationSettings(),
            seed: expect.any(Number),
          },
        },
        startedAt: null,
        creator,
        players: [creator, joiner],
        status: GameLobbyStatus.READY_TO_START,
        canJoin: false,
        canLeave: true,
        canStart: false,
      })
    })

    it("should reject joining a game the player is already in", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({
        configuration: {
          name: "already joined game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.gameLobbies.join.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameLobbies.join.mutate({ gameId: 1 })).rejects.toMatchObject({
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

      const newGameSettings: CreateGameDto["configuration"] = {
        name: "leave game",
        nbSeats: 3,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({ configuration: newGameSettings })

      authService.account = leaverAccount
      await trpcClient.client.gameLobbies.join.mutate({ gameId: createdGameId })

      // Act
      const leaveGameResult = await trpcClient.client.gameLobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>(true)

      const leftGameSummary = await trpcClient.client.gameLobbies.getGameLobbyById.query({ gameId: createdGameId })
      const creator: GameLobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(leftGameSummary).toEqual<typeof leftGameSummary>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: {
          ...newGameSettings,
          starSystemGenerationSettings: {
            ...createDefaultStarSystemGenerationSettings(),
            seed: expect.any(Number),
          },
        },
        startedAt: null,
        creator,
        players: [creator],
        status: GameLobbyStatus.WAITING_FOR_PLAYERS,
        canJoin: true, // Because left
        canLeave: false, // Because left
        canStart: false, // Because not creator
      })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.gameLobbies.create.mutate({
        configuration: {
          name: "creator cannot leave game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.gameLobbies.leave.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameLobbies.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
