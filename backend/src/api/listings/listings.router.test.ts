import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("listings.router", () => {
  describe("getListings", () => {
    it("should get listings when anonymous", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const anonymous = await apiServer.createClient({ authenticated: false })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await anonymous.client.listings.getListings.query()

      // Assert
      expect(getListingsResult).toEqual<typeof getListingsResult>([
        {
          id: createdGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: false,
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
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const otherCreator = await apiServer.createClient({ authenticated: true })

      const joinedGameSettings = createGameConfigurationDtoStub({ name: "Joined game" })
      const { createdGameId: joinedGameId } = await creator.client.lobbies.create.mutate({ configuration: joinedGameSettings })
      const unjoinedGameSettings = createGameConfigurationDtoStub({ name: "Unjoined game" })
      const { createdGameId: unjoinedGameId } = await otherCreator.client.lobbies.create.mutate({ configuration: unjoinedGameSettings })

      // Act
      const getListingsResult = await creator.client.listings.getListings.query()

      // Assert
      expect(getListingsResult.toSorted((left, right) => left.name.localeCompare(right.name))).toEqual<typeof getListingsResult>([
        {
          id: joinedGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: true,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: joinedGameSettings.name,
          nbPlayers: 1,
          nbSeats: joinedGameSettings.nbSeats,
        },
        {
          id: unjoinedGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: false,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: unjoinedGameSettings.name,
          nbPlayers: 1,
          nbSeats: unjoinedGameSettings.nbSeats,
        },
      ])
    })
  })
})
