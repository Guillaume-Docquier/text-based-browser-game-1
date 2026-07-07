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
      const { api, accountsRepository } = await createApiStub()
      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using creatorTrpcClient = new TrpcClient({ api, account: creatorAccount })
      using anonymousTrpcClient = new TrpcClient({ api, account: creatorAccount })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await anonymousTrpcClient.client.listings.getListings.query()

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
      const { api, accountsRepository } = await createApiStub()
      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      using creatorTrpcClient = new TrpcClient({ api, account: creatorAccount })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcClient.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await creatorTrpcClient.client.listings.getListings.query()

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
