import { Range } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createStarSystemGenerationSettingsDefaults } from "#api/gameplay/star-systems/createStarSystemGenerationSettingsDefaults.ts"
import { StarSystemGenerationSettingsLimits } from "#api/gameplay/star-systems/StarSystemGenerationSettingsLimits.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { type LobbyPlayerDto } from "#api/lobbies/lobbies.controller.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("lobbies.router", () => {
  describe("getCreationSettings", () => {
    it("should return backend-driven defaults and limits", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // Act
      const creationSettings = await trpcClient.client.lobbies.getCreationSettings.query()

      // Assert
      expect(creationSettings).toEqual<typeof creationSettings>({
        defaultStarSystemGenerationSettings: {
          ...createStarSystemGenerationSettingsDefaults(),
          seed: expect.any(Number),
        },
        starSystemGenerationSettingsLimits: StarSystemGenerationSettingsLimits,
      })
    })
  })

  describe("create", () => {
    it("should create a game for the authenticated player", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const newGameSettings = createGameConfigurationDtoStub()

      // Act
      const createLobbyResult = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createLobbyResult).toEqual<typeof createLobbyResult>({ createdGameId: expect.any(Number) })

      const createdGame = await trpcClient.client.lobbies.getById.query({ gameId: createLobbyResult.createdGameId })
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(createdGame).toEqual<typeof createdGame>({
        id: createLobbyResult.createdGameId,
        createdAt: expect.any(String),
        configuration: newGameSettings,
        endedAt: null,
        startedAt: null,
        winnerAccountId: null,
        creator,
        players: [creator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false, // because already joined
        canLeave: false, // because creator
        canStart: true, // because creator
        canOpen: false, // because not started
      })
    })

    it("should reject anonymous game creation", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.lobbies.create.mutate({
          configuration: createGameConfigurationDtoStub(),
        }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should reject Star System generation settings outside the accepted limits", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // Act & Assert
      await expect(
        trpcClient.client.lobbies.create.mutate({
          configuration: createGameConfigurationDtoStub({
            starSystemGenerationSettings: createStarSystemGenerationSettingsStub({
              planetDensity: Range.float({ min: 0.5, max: 1.1 }),
            }),
          }),
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject a non-integer Star System generation seed", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // Act & Assert
      await expect(
        trpcClient.client.lobbies.create.mutate({
          configuration: createGameConfigurationDtoStub({
            starSystemGenerationSettings: createStarSystemGenerationSettingsStub({
              seed: 1.5,
            }),
          }),
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
  })

  describe("getById", () => {
    it("should get a lobby by id when authenticated", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = viewerAccount

      // Act
      const lobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(lobby).toEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
        startedAt: null,
        creator,
        players: [creator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true,
        canLeave: false,
        canStart: false,
        canOpen: false,
      })
    })

    it("should get a lobby by id anonymously", async () => {
      // Arrange

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      authService.account = creatorAccount

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = undefined

      // Act
      const lobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      expect(lobby).toEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
        startedAt: null,
        creator,
        players: [creator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: false,
        canLeave: false,
        canStart: false,
        canOpen: false, // Because anonymous
      })
    })

    it("should only allow joined players to open a started game", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const viewerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Viewer" })))
      authService.account = creatorAccount

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })

      authService.account = viewerAccount
      const nonPlayerLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })

      authService.account = undefined
      const anonymousLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      expect({
        player: { status: playerLobby.status, canOpen: playerLobby.canOpen },
        nonPlayer: { status: nonPlayerLobby.status, canOpen: nonPlayerLobby.canOpen },
        anonymous: { status: anonymousLobby.status, canOpen: anonymousLobby.canOpen },
      }).toEqual({
        player: { status: GameStatus.STARTED, canOpen: true },
        nonPlayer: { status: GameStatus.STARTED, canOpen: false },
        anonymous: { status: GameStatus.STARTED, canOpen: false },
      })
    })

    it("should return not found when getting a missing lobby by id", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.lobbies.getById.query({ gameId: 404 })).rejects.toMatchObject({
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

      const newGameSettings = createGameConfigurationDtoStub({ nbSeats: 2 })
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = joinerAccount

      // Act
      const joinGameResult = await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({ playerId: joinerAccount.id })

      const joinedLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }
      const joiner: LobbyPlayerDto = { id: joinerAccount.id, alias: joinerAccount.alias }

      expect(joinedLobby).toEqual<typeof joinedLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
        startedAt: null,
        creator,
        players: [creator, joiner],
        status: GameStatus.READY_TO_START,
        canJoin: false,
        canLeave: true,
        canStart: false,
        canOpen: false,
      })
    })

    it("should reject joining a game the player is already in", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

      // Act & Assert
      await expect(trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.lobbies.join.mutate({ gameId: 1 })).rejects.toMatchObject({
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

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authService.account = leaverAccount
      await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const leaveGameResult = await trpcClient.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>(true)

      const leftLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })
      const creator: LobbyPlayerDto = { id: creatorAccount.id, alias: creatorAccount.alias }

      expect(leftLobby).toEqual<typeof leftLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
        startedAt: null,
        creator,
        players: [creator],
        status: GameStatus.WAITING_FOR_PLAYERS,
        canJoin: true, // Because left
        canLeave: false, // Because left
        canStart: false, // Because not creator
        canOpen: false, // Because not joined
      })
    })

    it("should reject leaving a game as its creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

      // Act & Assert
      await expect(trpcClient.client.lobbies.leave.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.lobbies.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
