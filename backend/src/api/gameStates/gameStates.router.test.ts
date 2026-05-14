import { Logger, type Success } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { PlayersRepository, type PlayerRow } from "#lib/db/players/players.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gameStates.router", () => {
  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "running game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })

      // Act
      const getByIdResult = await trpcClient.client.gameStates.getById.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameState: {
          gameId: createGameResult.newGame.id,
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
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameStates.getById.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gameStates.getById.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
