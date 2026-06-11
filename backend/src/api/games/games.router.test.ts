import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { type CreateLobbyDto, type LobbyPlayerDto, GameLobbyStatus } from "#api/lobbies/lobbies.controller.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("games.router", () => {
  describe("getSummaries", () => {
    it("should get summaries anonymously", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateLobbyDto["configuration"] = {
        name: "public game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = undefined

      // Act
      const getGameLobbiesResult = await trpcClient.client.games.getGameLobbies.query()

      // Assert
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(getGameLobbiesResult).toEqual<typeof getGameLobbiesResult>([
        {
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
          canJoin: false, // because anonymous
          canLeave: false, // because not in the game
          canStart: false, // because not the creator
        },
      ])
    })

    it("should get summaries for an authenticated player who can join", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings: CreateLobbyDto["configuration"] = {
        name: "joinable game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = viewerAccount

      // Act
      const lobbiesResult = await trpcClient.client.games.getGameLobbies.query()

      // Assert
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(lobbiesResult).toEqual<typeof lobbiesResult>([
        {
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
          canJoin: true, // because not in the game
          canLeave: false, // because not in the game
          canStart: false, // because not the creator
        },
      ])
    })
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings: CreateLobbyDto["configuration"] = {
        name: "start game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await trpcClient.client.games.start.mutate({ gameId: createdGameId })

      // Assert

      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(startGameResult).toEqual<typeof startGameResult>({
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
        startedAt: expect.any(String),
        creator,
        players: [creator],
        status: GameLobbyStatus.STARTED,
        canJoin: false, // Because started
        canLeave: false, // Because started
        canStart: false, // Because started
      })
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creator

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: {
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
