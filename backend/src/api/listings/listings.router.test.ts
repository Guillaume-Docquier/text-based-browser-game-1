import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

describe("listings.router", () => {
  describe("getListings", () => {
    it("should get listings when anonymous", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()
      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using apiServer = new ApiServer({ api })
      const creatorTrpcClient = apiServer.createClient({ account: creatorAccount })
      const anonymousTrpcClient = apiServer.createClient()

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcClient.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await anonymousTrpcClient.listings.getListings.query()

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
      using apiServer = new ApiServer({ api })
      const creatorTrpcClient = apiServer.createClient({ account: creatorAccount })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcClient.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await creatorTrpcClient.listings.getListings.query()

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
