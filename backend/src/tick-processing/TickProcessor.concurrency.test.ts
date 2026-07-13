import { setTimeout } from "node:timers/promises"
import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import type { PlayerView } from "#api/types.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"

// This suite is vibe coded and works, but it's bad code. If it causes trouble, get rid of it
describe("tick processing concurrency", () => {
  it("should process the last order accepted before its tick starts", async () => {
    // Arrange
    await using apiServer = await ConcurrencyTestApiServer.create()
    const player = await apiServer.createClient({ authenticated: true })
    const { createdGameId } = await player.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 1 }),
    })
    await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

    const playerView = await waitForPlayerMoney({ player, gameId: createdGameId, minimumMoney: 2 })
    const targetTick = playerView.tick
    const moneyBeforeTick = playerView.resources.money
    const timeUntilOrderSubmission = new Date(playerView.nextTickAt).getTime() - Date.now() - 100
    if (timeUntilOrderSubmission > 0) {
      await setTimeout(timeUntilOrderSubmission)
    }

    // Act
    let lastAcceptedAction: GamePlayerActionType | null | undefined
    let orderWasRejected = false
    for (let requestIndex = 0; requestIndex < 400; requestIndex++) {
      const actionType = requestIndex % 2 === 0 ? GamePlayerActionType.MAKE_MORE_MONEY : null
      const setActionResult = await Result.tryCatch(
        player.client.gameplay.setCurrentAction.mutate({ gameId: createdGameId, tick: targetTick, actionType }),
      )
      if (Result.isFailure(setActionResult)) {
        orderWasRejected = true
        break
      }

      lastAcceptedAction = actionType
      await setTimeout(5)
    }

    // Assert
    Assert.isDefined(lastAcceptedAction)
    expect(orderWasRejected).toBe(true)

    const processedPlayerView = await waitForTick({ player, gameId: createdGameId, minimumTick: targetTick + 1 })
    const expectedMoney = lastAcceptedAction === null ? moneyBeforeTick + 1 : moneyBeforeTick + 4
    expect(processedPlayerView.resources.money).toBe(expectedMoney)
  })
})

async function waitForPlayerMoney({
  player,
  gameId,
  minimumMoney,
}: {
  player: AuthenticatedApiClient
  gameId: number
  minimumMoney: number
}): Promise<PlayerView> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    if (playerView.resources.money >= minimumMoney) {
      return playerView
    }
    await setTimeout(10)
  }

  throw new Error(`Player did not reach ${minimumMoney} money`)
}

async function waitForTick({
  player,
  gameId,
  minimumTick,
}: {
  player: AuthenticatedApiClient
  gameId: number
  minimumTick: number
}): Promise<PlayerView> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const playerView = await player.client.gameplay.getPlayerView.query({ gameId })
    if (playerView.tick >= minimumTick) {
      return playerView
    }
    await setTimeout(10)
  }

  throw new Error(`Game did not reach tick ${minimumTick}`)
}
