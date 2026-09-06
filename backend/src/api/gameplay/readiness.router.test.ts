import { Assert, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("readiness", () => {
  it("should lock ready players' actions, allow unreadying, and close and reset an early turn", async () => {
    // Arrange
    const db = await createDbMock()
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ db, clock }))
    const alice = await server.createClient({ authenticated: true })
    const bob = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ nbSeats: 2, turnIntervalSeconds: 3600 }),
    })
    await bob.client.lobbies.join.mutate({ gameId })
    await alice.client.gameplay.startGame.mutate({ gameId })
    const initial = await alice.client.gameplay.getPlayerView.query({ gameId })
    const action = initial.actions.find(({ canAfford }) => canAfford)
    Assert.isDefined(action)
    const submission = { gameId, turn: 0, submittedActionTargets: { actionId: action.id, targets: {} } }
    await alice.client.gameplay.updateActionSubmission.mutate(submission)
    const { turnProcessor } = await createTurnProcessorStub({ db, clock })

    // Act
    await alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true })
    const bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
    const lockedAction = await Result.tryCatch(
      alice.client.gameplay.updateActionSubmission.mutate({
        ...submission,
        submittedActionTargets: { actionId: action.id, targets: null },
      }),
    )
    await alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: false })
    await alice.client.gameplay.updateActionSubmission.mutate({
      ...submission,
      submittedActionTargets: { actionId: action.id, targets: null },
    })
    await alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true })
    clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
    await bob.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true })
    const closedView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const lateUnready = await Result.tryCatch(alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: false }))
    const lateSubmission = await Result.tryCatch(bob.client.gameplay.updateActionSubmission.mutate(submission))
    clock.increment({ time: Time.create(1, UnitOfTime.SECONDS) })
    const outcome = await turnProcessor.processNextDueTurn()
    const nextView = await alice.client.gameplay.getPlayerView.query({ gameId })
    const staleReadiness = await Result.tryCatch(alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true }))

    // Assert
    expect(initial.player.isReady).toBe(false)
    expect(bobView.opponents[initial.player.id]).toMatchObject({ isReady: true })
    expect(lockedAction).toStrictEqual(Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })))
    expect(closedView.turnStatus).toBe("AWAITING_PROCESSING")
    expect(lateUnready).toStrictEqual(Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })))
    expect(lateSubmission).toStrictEqual(
      Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })),
    )
    expect(outcome).toBe("processed")
    expect(nextView.turn).toBe(1)
    expect(nextView.turnStatus).toBe("COLLECTING_ACTIONS")
    expect(nextView.turnEndsAt).toBe("1970-01-01T01:01:00.000Z")
    expect(nextView.player.isReady).toBe(false)
    expect(Object.values(nextView.opponents).map(({ isReady }) => isReady)).toStrictEqual([false])
    expect(staleReadiness).toStrictEqual(
      Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })),
    )
  })

  it("should reject readiness from outsiders and after the deadline", async () => {
    // Arrange
    const clock = new ControlledClock()
    using server = new ApiServer(await createApiStub({ clock }))
    const alice = await server.createClient({ authenticated: true })
    const outsider = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await alice.client.lobbies.create.mutate({
      configuration: createLobbyConfigurationDtoStub({ turnIntervalSeconds: 60 }),
    })
    await alice.client.gameplay.startGame.mutate({ gameId })

    // Act
    const unauthorized = await Result.tryCatch(outsider.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true }))
    clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
    const expired = await Result.tryCatch(alice.client.gameplay.setReady.mutate({ gameId, turn: 0, isReady: true }))
    const view = await alice.client.gameplay.getPlayerView.query({ gameId })

    // Assert
    expect(unauthorized).toStrictEqual(Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "FORBIDDEN" }) })))
    expect(expired).toStrictEqual(Result.Failure(expect.objectContaining({ data: expect.objectContaining({ code: "BAD_REQUEST" }) })))
    expect(view.player.isReady).toBe(false)
  })
})
