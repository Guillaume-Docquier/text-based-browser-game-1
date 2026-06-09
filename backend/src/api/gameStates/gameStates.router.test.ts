import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gameStates.router", () => {
  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authService.account = account

      const { createdGameId } = await trpcClient.client.games.create.mutate({
        settings: { name: "running game", nbSeats: 2, tickIntervalSeconds: 60 },
      })

      await trpcClient.client.games.start.mutate({ gameId: createdGameId })

      // Act
      const getByIdResult = await trpcClient.client.gameStates.getById.query({ gameId: createdGameId })

      // Assert
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameState: {
          gameId: createdGameId,
          playerId: account.id,
          tick: 0,
          nextTickAt: expect.any(String),
          resources: {
            money: 0,
          },
        },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange

      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // Act & Assert
      await expect(trpcClient.client.gameStates.getById.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameStates.getById.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
