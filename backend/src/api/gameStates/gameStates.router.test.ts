import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createGameRouterInputStub } from "#api/games/CreateGameCommand.stub.ts"

describe("gameStates.router", () => {
  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: createGameRouterInputStub({
          name: "running game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        }),
      })

      await trpcClient.client.games.start.mutate({ gameId: newGame.id })

      // Act
      const getByIdResult = await trpcClient.client.gameStates.getById.query({ gameId: newGame.id })

      // Assert
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameState: {
          gameId: newGame.id,
          playerId: player.id,
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

      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

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
