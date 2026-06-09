import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourceUpdateModelStub } from "#lib/db/resources/ResourceUpdateModel.stub.ts"
import { GamePlayerActionType } from "#lib/gamePlayerActions.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gamePlayerActions.router", () => {
  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const { api, authService, gamePlayerResourcesRepository, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.games.start.mutate({ gameId: createdGameId })
      await gamePlayerResourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const setCurrentActionResult = await trpcClient.client.gamePlayerActions.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
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

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: { name: "stale tick game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.games.start.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(
        trpcClient.client.gamePlayerActions.setCurrentAction.mutate({
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
      const { api, authService, accountsRepository, gamePlayerResourcesRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
      })
      await trpcClient.client.games.start.mutate({ gameId: createdGameId })
      await gamePlayerResourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
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
      await expect(trpcClient.client.gamePlayerActions.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
