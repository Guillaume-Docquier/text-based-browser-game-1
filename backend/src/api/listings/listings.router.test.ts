import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("listings.router", () => {
  describe("getListings", () => {
    it("should get listings when anonymous", async () => {
      // Arrange
      const { api, authProvider, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authProvider.account = creatorAccount

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authProvider.account = undefined

      // Act
      const getListingsResult = await trpcClient.client.listings.getListings.query()

      // Assert
      expect(getListingsResult).toEqual<typeof getListingsResult>([
        {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: newGameSettings.name,
          nbPlayers: 1,
          nbSeats: newGameSettings.nbSeats,
        },
      ])
    })

    it("should get listings when authenticated", async () => {
      // Arrange
      const { api, authProvider, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      authProvider.account = creatorAccount

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      authProvider.account = creatorAccount

      // Act
      const getListingsResult = await trpcClient.client.listings.getListings.query()

      // Assert
      expect(getListingsResult).toEqual<typeof getListingsResult>([
        {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: newGameSettings.name,
          nbPlayers: 1,
          nbSeats: newGameSettings.nbSeats,
        },
      ])
    })
  })
})
