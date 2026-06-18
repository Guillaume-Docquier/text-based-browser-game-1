import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { type CreateLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { createResourceUpdateModelStub } from "#tests/resources/ResourceUpdateModel.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    const { api, authService, accountsRepository } = await createApiStub()
    using trpcClient = new TrpcClient({ api })

    authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "private gameplay", nbSeats: 2, tickIntervalSeconds: 60 },
    })

    authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(trpcClient.client.gameplay.getCurrentAction.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(
      trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const newGameSettings: CreateLobbyDto["configuration"] = {
        name: "start game",
        nbSeats: 2,
        tickIntervalSeconds: 60,
      }

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({ nextTickAt: expect.any(String) }) // trpc serializes the date to string
      expect(new Date(startGameResult.nextTickAt).toString()).not.toBe("Invalid Date")
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: {
          name: "non creator cannot start game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should start two games with identical deterministic Star Systems", async () => {
      // Arrange
      const { api, authService, accountsRepository, lobbiesRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account
      const starSystemGenerationSettings = createStarSystemGenerationSettingsStub({ seed: 42 })
      const firstGame = extractSuccess(
        // We'll use the route instead when it is available
        await lobbiesRepository.createLobby({
          createdByAccountId: account.id,
          configuration: {
            name: "first deterministic game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            starSystemGenerationSettings,
          },
        }),
      )
      const secondGame = extractSuccess(
        // We'll use the route instead when it is available
        await lobbiesRepository.createLobby({
          createdByAccountId: account.id,
          configuration: {
            name: "second deterministic game",
            nbSeats: 2,
            tickIntervalSeconds: 60,
            starSystemGenerationSettings,
          },
        }),
      )

      // Act
      await trpcClient.client.gameplay.startGame.mutate({ gameId: firstGame.createdGameId })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: secondGame.createdGameId })

      // Assert
      // Fix me
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameplay.startGame.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: { name: "running game", nbSeats: 2, tickIntervalSeconds: 60 },
      })

      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const getByIdResult = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameId: createdGameId,
        playerId: account.id,
        tick: 0,
        nextTickAt: expect.any(String),
        starSystem: expect.objectContaining({
          // Fix me
          orbits: expect.arrayContaining([expect.objectContaining({ number: 1 })]),
          movementEdges: expect.any(Object),
        }),
        resources: {
          money: 0,
        },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // Act & Assert
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      await expect(trpcClient.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameplay.getPlayerView.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, authService, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const setCurrentActionResult = await trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      const getCurrentActionResult = await trpcClient.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
        action: {
          gameId: createdGameId,
          playerId: account.id,
          tick: 0,
          actionType: GamePlayerActionType.MAKE_MORE_MONEY,
          updatedAt: expect.any(String),
        },
      })
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>(setCurrentActionResult)
    })

    it("should reject setting an action for a stale tick", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: { name: "stale tick game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(
        trpcClient.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 1,
          actionType: GamePlayerActionType.MAKE_MORE_MONEY,
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
  })

  describe("getCurrentAction", () => {
    it("should get the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, authService, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const getCurrentActionResult = await trpcClient.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameplay.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
