import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("listings.router", () => {
  describe("getListings", () => {
    it("should get listings when anonymous", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())

      const anonymous = await apiServer.createClient({ authenticated: false })

      const creator = await apiServer.createClient({ authenticated: true })
      const newGameSettings = createLobbyConfigurationDtoStub()
      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const getListingsResult = await anonymous.client.listings.getListings.query()

      // Assert
      expect(getListingsResult).toStrictEqual<typeof getListingsResult>([
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
      const joinedGameSettings = createLobbyConfigurationDtoStub({ name: "Joined game" })
      const { createdGameId: joinedGameId } = await creator.client.lobbies.create.mutate({ configuration: joinedGameSettings })

      const otherCreator = await apiServer.createClient({ authenticated: true })
      const notJoinedGameSettings = createLobbyConfigurationDtoStub({ name: "Not joined game" })
      const { createdGameId: notJoinedGameId } = await otherCreator.client.lobbies.create.mutate({ configuration: notJoinedGameSettings })

      // Act
      const getListingsResult = await creator.client.listings.getListings.query()

      // Assert
      expect(getListingsResult).toStrictEqual<typeof getListingsResult>([
        {
          id: notJoinedGameId,
          createdAt: expect.any(String),
          endedAt: null,
          hasJoined: false,
          startedAt: null,
          status: GameStatus.WAITING_FOR_PLAYERS,
          name: notJoinedGameSettings.name,
          nbPlayers: 1,
          nbSeats: notJoinedGameSettings.nbSeats,
        },
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
      ])
    })
  })
})
