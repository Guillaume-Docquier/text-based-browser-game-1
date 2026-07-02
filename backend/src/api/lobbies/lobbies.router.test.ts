import { Range, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createStarSystemGenerationSettingsDefaults } from "#api/gameplay/star-systems/createStarSystemGenerationSettingsDefaults.ts"
import { StarSystemGenerationSettingsLimits } from "#api/gameplay/star-systems/StarSystemGenerationSettingsLimits.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { type LobbyPlayerDto } from "#api/lobbies/lobbies.controller.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("lobbies.router", () => {
  describe("getCreationSettings", () => {
    it("should return backend-driven defaults and limits", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      const creationSettings = await player.client.lobbies.getCreationSettings.query()

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
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub()

      // Act
      const createLobbyResult = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Assert
      expect(createLobbyResult).toEqual<typeof createLobbyResult>({ createdGameId: expect.any(Number) })

      const createdGame = await creator.client.lobbies.getById.query({ gameId: createLobbyResult.createdGameId })
      const expectedCreator: LobbyPlayerDto = { id: creator.account.id, alias: creator.account.alias }

      expect(createdGame).toEqual<typeof createdGame>({
        id: createLobbyResult.createdGameId,
        createdAt: expect.any(String),
        configuration: newGameSettings,
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

    it("should reject anonymous game creation", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(
        anonymous.client.lobbies.create.mutate({
          configuration: createGameConfigurationDtoStub(),
        }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should reject Star System generation settings outside the accepted limits", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(
        player.client.lobbies.create.mutate({
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
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(
        player.client.lobbies.create.mutate({
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
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await viewer.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: LobbyPlayerDto = { id: creator.account.id, alias: creator.account.alias }
      expect(lobby).toEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
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
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const lobby = await anonymous.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      const expectedCreator: LobbyPlayerDto = { id: creator.account.id, alias: creator.account.alias }
      expect(lobby).toEqual<typeof lobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
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

    it("should only allow joined players to open a started game", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const viewer = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerLobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      const nonPlayerLobby = await viewer.client.lobbies.getById.query({ gameId: createdGameId })
      const anonymousLobby = await anonymous.client.lobbies.getById.query({ gameId: createdGameId })

      // Assert
      expect({
        player: { status: playerLobby.status, canOpen: playerLobby.canOpen },
        nonPlayer: { status: nonPlayerLobby.status, canOpen: nonPlayerLobby.canOpen },
        anonymous: { status: anonymousLobby.status, canOpen: anonymousLobby.canOpen },
      }).toEqual({
        player: { status: GameStatus.COLLECTING_ORDERS, canOpen: true },
        nonPlayer: { status: GameStatus.COLLECTING_ORDERS, canOpen: false },
        anonymous: { status: GameStatus.COLLECTING_ORDERS, canOpen: false },
      })
    })

    it("should return not found when getting a missing lobby by id", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.lobbies.getById.query({ gameId: 404 })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })

  describe("join", () => {
    it("should join a game", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub({ nbSeats: 2 })
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const joinGameResult = await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Assert
      expect(joinGameResult).toEqual<typeof joinGameResult>({ playerId: joiner.account.id })

      const joinedLobby = await joiner.client.lobbies.getById.query({ gameId: createdGameId })
      const expectedCreator: LobbyPlayerDto = { id: creator.account.id, alias: creator.account.alias }
      const expectedJoiner: LobbyPlayerDto = { id: joiner.account.id, alias: joiner.account.alias }

      expect(joinedLobby).toEqual<typeof joinedLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
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

    it("should not overfill a game when multiple players join concurrently", async () => {
      // Arrange
      const { api, authService, accountsRepository, lobbiesRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const joinerAccounts = [
        extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" }))),
        extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 3" }))),
        extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 4" }))),
      ]
      authService.account = creatorAccount

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ nbSeats: 2 }),
      })

      // Act
      const joinResults = await Promise.all(
        joinerAccounts.map(async (account) => await lobbiesRepository.joinLobby({ gameId: createdGameId, accountId: account.id })),
      )

      // Assert
      expect(joinResults.filter(Result.isSuccess)).toHaveLength(1)
      expect(joinResults.filter(Result.isFailure)).toHaveLength(2)

      const joinedLobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })
      expect(joinedLobby.players).toHaveLength(2)
      expect(joinedLobby.status).toBe(GameStatus.READY_TO_START)
    })

    it("should reject joining a game that has started", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      const joinerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = creatorAccount

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      authService.account = joinerAccount

      // Act & Assert
      await expect(trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
    it("should reject joining a game the player is already in", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

      // Act & Assert
      await expect(player.client.lobbies.join.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game join", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.lobbies.join.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("leave", () => {
    it("should leave a game", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const leaver = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      await leaver.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act
      const leaveGameResult = await leaver.client.lobbies.leave.mutate({ gameId: createdGameId })

      // Assert
      expect(leaveGameResult).toEqual<typeof leaveGameResult>(true)

      const leftLobby = await leaver.client.lobbies.getById.query({ gameId: createdGameId })
      const expectedCreator: LobbyPlayerDto = { id: creator.account.id, alias: creator.account.alias }

      expect(leftLobby).toEqual<typeof leftLobby>({
        id: createdGameId,
        createdAt: expect.any(String),
        endedAt: null,
        winnerAccountId: null,
        configuration: newGameSettings,
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

    it("should reject leaving a game that has started", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const leaverAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Player 2" })))
      authService.account = creatorAccount

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

      authService.account = leaverAccount
      await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

      authService.account = creatorAccount
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      authService.account = leaverAccount

      // Act & Assert
      await expect(trpcClient.client.lobbies.leave.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
    it("should reject leaving a game as its creator", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

      // Act & Assert
      await expect(player.client.lobbies.leave.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game leave", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.lobbies.leave.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
