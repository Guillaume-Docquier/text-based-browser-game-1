import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { GamePlayerActionType } from "#lib/gamePlayerActions.ts"
import { createResourceUpdateStub } from "#lib/db/resources/ResourceUpdate.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

describe("gamePlayerActions.router", () => {
  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const { api, authService, gamePlayerResourcesRepository, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const { newGame } = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
        },
      })
      await trpcClient.client.games.start.mutate({ gameId: newGame.id })
      await gamePlayerResourcesRepository.updateResource(
        createResourceUpdateStub({ gameId: newGame.id, playerId: player.id, amountDelta: 2 }),
      )

      // Act
      const setCurrentActionResult = await trpcClient.client.gamePlayerActions.setCurrentAction.mutate({
        gameId: newGame.id,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
        gameId: newGame.id,
      })

      // Assert
      expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
        action: {
          gameId: newGame.id,
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
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: { name: "stale tick game", nbSeats: 2, tickIntervalSeconds: 60 },
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
      const { api, authService, playersRepository, gamePlayerResourcesRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          settings: { name: "action game", nbSeats: 2, tickIntervalSeconds: 60 },
        },
      })
      await trpcClient.client.games.start.mutate({ gameId: createGameResult.newGame.id })
      await gamePlayerResourcesRepository.updateResource(
        createResourceUpdateStub({ gameId: createGameResult.newGame.id, playerId: player.id, amountDelta: 2 }),
      )

      // Act
      const getCurrentActionResult = await trpcClient.client.gamePlayerActions.getCurrentAction.query({
        gameId: createGameResult.newGame.id,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.gamePlayerActions.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
