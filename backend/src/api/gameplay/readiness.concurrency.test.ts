import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { ConcurrencyTestApiServer } from "#tests/ConcurrencyTestApiServer.ts"

describe("readiness concurrency", () => {
  it("should close a turn once when players ready concurrently with action submission", async () => {
    // Arrange
    await using server = await ConcurrencyTestApiServer.create()
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ nbSeats: 2, turnIntervalSeconds: 3600 }),
    })
    await bob.client.lobbies.join.mutate({ gameId })
    await alice.client.gameplay.startGame.mutate({ gameId })
    const view = await alice.client.gameplay.getPlayerView.query({ gameId })
    const action = view.actions.find(({ canAfford }) => canAfford)
    Assert.isDefined(action)

    // Act
    const [aliceReady, bobReady, submission] = await Promise.all([
      Result.tryCatch(alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true })),
      Result.tryCatch(bob.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true })),
      Result.tryCatch(
        alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: 0,
          submittedActionTargets: { actionId: action.id, targets: {} },
        }),
      ),
    ])
    const lateSubmission = await Result.tryCatch(
      alice.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: 0,
        submittedActionTargets: { actionId: action.id, targets: null },
      }),
    )

    // Assert
    expect(aliceReady).toStrictEqual(Result.Success(undefined))
    expect(bobReady).toStrictEqual(Result.Success(undefined))
    // The racing submission either wins the lock or is rejected after readiness.
    expect(submission).toStrictEqual(
      expect.toBeOneOf([
        Result.Success(undefined),
        Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })),
      ]),
    )
    expect(lateSubmission).toStrictEqual(
      Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })),
    )
    await expect.poll(async () => (await alice.client.gameplay.getPlayerView.query({ gameId })).turn).toBe(1)
    const nextView = await alice.client.gameplay.getPlayerView.query({ gameId })
    expect(nextView.player.isReady).toBe(false)
    expect(Object.values(nextView.opponents).map(({ isReady }) => isReady)).toStrictEqual([false])
  })
})
