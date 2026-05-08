import { describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { gamePlayerResourcesTable } from "#lib/db/schema.ts"
import { GamePlayerActionType } from "#lib/gamePlayerActions.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createPlayer } from "#tests/createPlayer.ts"

describe("gamePlayerActions.router", () => {
  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const player = await createPlayer(db, createPlayerRowInsertStub())

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
      await db.update(gamePlayerResourcesTable).set({ amount: 2 }).where(eq(gamePlayerResourcesTable.playerId, player.id))

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
      const player = await createPlayer(db, createPlayerRowInsertStub())

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
      const player = await createPlayer(db, createPlayerRowInsertStub())

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
      await db.update(gamePlayerResourcesTable).set({ amount: 2 }).where(eq(gamePlayerResourcesTable.playerId, player.id))

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
