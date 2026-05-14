import { describe, expect, it } from "vitest"
import { Logger, Result, type Success } from "@guillaume-docquier/tools-ts"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { PlayersRepository, type PlayerRow } from "#lib/db/players/players.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { GamePlayerActionType } from "#lib/gamePlayerActions.ts"
import { createGamePlayerResourceUpdateStub } from "#lib/db/gamePlayerResourceUpdate.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("gamePlayerActions.router", () => {
  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "action game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })
      const gamePlayerResourcesRepository = new GamePlayerResourcesRepository({ db, logger: Logger.get() })
      const addResourceResult = await gamePlayerResourcesRepository.updateResource(
        createGamePlayerResourceUpdateStub({ gameId: createGameResult.newGame.id, playerId: player.id, amountDelta: 2 }),
      )
      expect(Result.isSuccess(addResourceResult)).toBe(true)

      // Act
      const setCurrentActionResult = await trpcClient.client.gamePlayerActions.setCurrentAction.mutate({
        gameId: createGameResult.newGame.id,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
        gameId: createGameResult.newGame.id,
      })

      // Assert
      expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
        action: {
          gameId: createGameResult.newGame.id,
          playerId: player.id,
          tick: 0,
          actionType: GamePlayerActionType.MAKE_MORE_MONEY,
          updatedAt: expect.any(String),
        },
      })
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>(setCurrentActionResult)
    })

    it("should reject setting an action for a stale tick", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "stale tick game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })

      // Act & Assert
      await expect(
        trpcClient.client.gamePlayerActions.setCurrentAction.mutate({
          gameId: createGameResult.newGame.id,
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
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const player = ((await playersRepository.insert(createPlayerRowInsertStub()) as Success<PlayerRow>).value)

      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "action game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })
      const gamePlayerResourcesRepository = new GamePlayerResourcesRepository({ db, logger: Logger.get() })
      const addResourceResult = await gamePlayerResourcesRepository.updateResource(
        createGamePlayerResourceUpdateStub({ gameId: createGameResult.newGame.id, playerId: player.id, amountDelta: 2 }),
      )
      expect(Result.isSuccess(addResourceResult)).toBe(true)

      // Act
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
        gameId: createGameResult.newGame.id,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gamePlayerActions.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
