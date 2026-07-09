import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcServer } from "#tests/TrpcServer.ts"

describe("listings.router", () => {
  describe("getListings", () => {
    it("should get listings when anonymous", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()
      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using creatorTrpcServer = new TrpcServer({ api, account: creatorAccount })
      using anonymousTrpcServer = new TrpcServer({ api })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcServer.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await anonymousTrpcServer.client.listings.getListings.query()

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
      using creatorTrpcServer = new TrpcServer({ api, account: creatorAccount })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creatorTrpcServer.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await creatorTrpcServer.client.listings.getListings.query()

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
