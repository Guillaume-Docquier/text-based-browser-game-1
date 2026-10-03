import { Assert, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/game/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { GainMetal } from "shared/testing/test-ruleset/action-definitions/gain-metal.ts"
import { describe, expect, it } from "vitest"
import type { UpdateActionSubmissionDto } from "#api/gameplay/UpdateActionSubmissionUseCase.ts"
import { createLobbyConfigurationDtoStub } from "#api/lobbies/CreateLobbyConfigurationDto.stub.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { TurnConcurrencyFixture, within } from "#tests/TurnConcurrencyFixture.ts"

describe("turn locking on PostgreSQL", () => {
  it("should commit one transition and apply effects once when two workers compete for one due turn", async () => {
    // Arrange
    await using fixture = await TurnConcurrencyFixture.create()
    const { creator, gameId, submission } = await createGame(fixture)
    await creator.client.gameplay.updateActionSubmission.mutate(submission)
    await creator.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true })
    const first = fixture.createWorker()
    const second = fixture.createWorker()
    using claim = first.transactions.pauseNext()

    // Act
    const firstProcessing = first.processNextDueTurn()
    await claim.waitUntilHeld()
    const secondOutcome = await within(second.processNextDueTurn())
    claim.release()
    const firstOutcome = await within(firstProcessing)

    // Assert
    expect([firstOutcome, secondOutcome]).toStrictEqual(["processed", "idle"])
    expect(await creator.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 2,
      turnStatus: TurnStatus.COLLECTING_ACTIONS,
      player: { isReady: false },
      resources: {
        [ResourceType.METAL]: { total: 7, uncommitted: 7 },
        [ResourceType.INFLUENCE]: { total: 2, uncommitted: 2 },
      },
      actions: expect.arrayContaining([expect.objectContaining({ id: submission.submittedActionTargets.actionId, selectedTargets: null })]),
    })
    expect(await second.processNextDueTurn()).toBe("idle")
  })

  it("should process another due game before the first game's held claim commits", async () => {
    // Arrange
    await using fixture = await TurnConcurrencyFixture.create()
    const earlier = await createGame(fixture, { turnIntervalSeconds: 30 })
    const later = await createGame(fixture, { turnIntervalSeconds: 60 })
    await earlier.creator.client.gameplay.updateActionSubmission.mutate(earlier.submission)
    await later.creator.client.gameplay.updateActionSubmission.mutate(later.submission)
    const first = fixture.createWorker()
    const second = fixture.createWorker()
    fixture.clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
    await first.repository.markDueTurnsAwaitingProcessing({ since: fixture.clock.now() })
    using claim = first.transactions.pauseNext()

    // Act
    const firstProcessing = first.processNextDueTurn()
    await claim.waitUntilHeld()
    const secondOutcome = await within(second.processNextDueTurn())
    const earlierWhileHeld = await earlier.creator.client.gameplay.getPlayerView.query({ gameId: earlier.gameId })
    const laterWhileHeld = await later.creator.client.gameplay.getPlayerView.query({ gameId: later.gameId })
    claim.release()
    const firstOutcome = await within(firstProcessing)

    // Assert
    expect([firstOutcome, secondOutcome]).toStrictEqual(["processed", "processed"])
    expect(earlierWhileHeld).toMatchObject({ turn: 1, turnStatus: TurnStatus.AWAITING_PROCESSING, resources: { METAL: { total: 2 } } })
    expect(laterWhileHeld).toMatchObject({ turn: 2, resources: { METAL: { total: 7 }, INFLUENCE: { total: 2 } } })
    expect(await earlier.creator.client.gameplay.getPlayerView.query({ gameId: earlier.gameId })).toMatchObject({
      turn: 2,
      resources: { METAL: { total: 7 }, INFLUENCE: { total: 2 } },
    })
  })

  it("should include a submission holding the Turn lock when deadline closure races its commit", async () => {
    // Arrange
    await using fixture = await TurnConcurrencyFixture.create()
    const { creator, gameId, submission } = await createGame(fixture)
    const worker = fixture.createWorker()
    using action = fixture.apiTransactions.pauseNext()

    // Act
    const submitting = Result.tryCatch(creator.client.gameplay.updateActionSubmission.mutate(submission))
    await action.waitUntilHeld()
    fixture.clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
    const closing = worker.repository.markDueTurnsAwaitingProcessing({ since: fixture.clock.now() })
    const blockedQuery = await fixture.waitUntilBlockedBy(action)
    action.release()
    const submissionOutcome = await within(submitting)
    await within(closing)
    const closedView = await creator.client.gameplay.getPlayerView.query({ gameId })
    const processingOutcome = await worker.processNextDueTurn()

    // Assert
    expect(blockedQuery).toContain('update "turns"')
    expect(submissionOutcome).toStrictEqual(Result.Success(undefined))
    expect(closedView).toMatchObject({
      turn: 1,
      turnStatus: TurnStatus.AWAITING_PROCESSING,
      actions: expect.arrayContaining([expect.objectContaining({ id: submission.submittedActionTargets.actionId, selectedTargets: {} })]),
    })
    expect(processingOutcome).toBe("processed")
    expect(await creator.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({ turn: 2, resources: { METAL: { total: 7 } } })
  })

  it("should include a submission that commits before the last player's Readiness closes the Turn", async () => {
    // Arrange
    await using fixture = await TurnConcurrencyFixture.create()
    const { creator, gameId, submission } = await createGame(fixture)
    using action = fixture.apiTransactions.pauseNext()

    // Act
    const submitting = Result.tryCatch(creator.client.gameplay.updateActionSubmission.mutate(submission))
    await action.waitUntilHeld()
    const readying = Result.tryCatch(creator.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true }))
    const blockedQuery = await fixture.waitUntilBlockedBy(action)
    action.release()
    const outcomes = await within(Promise.all([submitting, readying]))
    const closedView = await creator.client.gameplay.getPlayerView.query({ gameId })
    const worker = fixture.createWorker()
    const processingOutcome = await worker.processNextDueTurn()

    // Assert
    expect(blockedQuery).toContain('from "turns"')
    expect(outcomes).toStrictEqual([Result.Success(undefined), Result.Success(undefined)])
    expect(closedView).toMatchObject({ turn: 1, turnStatus: TurnStatus.AWAITING_PROCESSING, player: { isReady: true } })
    expect(processingOutcome).toBe("processed")
    expect(await creator.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
      turn: 2,
      player: { isReady: false },
      resources: { METAL: { total: 7 }, INFLUENCE: { total: 2 } },
    })
  })

  it.each([
    { nbPlayers: 1, expectedStatus: TurnStatus.AWAITING_PROCESSING, expectedError: "Cannot submit actions for this turn" },
    { nbPlayers: 2, expectedStatus: TurnStatus.COLLECTING_ACTIONS, expectedError: "Cannot submit actions while ready" },
  ])(
    "should reject a racing submission when Readiness commits first in a $nbPlayers-player game",
    async ({ nbPlayers, expectedStatus, expectedError }) => {
      // Arrange
      await using fixture = await TurnConcurrencyFixture.create()
      const { creator, gameId, submission } = await createGame(fixture, { nbPlayers })
      using readiness = fixture.apiTransactions.pauseNext()

      // Act
      const readying = Result.tryCatch(creator.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true }))
      await readiness.waitUntilHeld()
      const submitting = Result.tryCatch(creator.client.gameplay.updateActionSubmission.mutate(submission))
      const blockedQuery = await fixture.waitUntilBlockedBy(readiness)
      readiness.release()
      const readinessOutcome = await within(readying)
      const submissionOutcome = await within(submitting)
      const view = await creator.client.gameplay.getPlayerView.query({ gameId })
      const worker = fixture.createWorker()
      fixture.clock.increment({ time: Time.create(60, UnitOfTime.SECONDS) })
      await worker.repository.markDueTurnsAwaitingProcessing({ since: fixture.clock.now() })
      const processingOutcome = await worker.processNextDueTurn()

      // Assert
      expect(blockedQuery).toContain('from "turns"')
      expect(readinessOutcome).toStrictEqual(Result.Success(undefined))
      expect(submissionOutcome).toStrictEqual(
        Result.Failure(
          expect.objectContaining({
            message: expectedError,
            data: expect.objectContaining({ code: "BAD_REQUEST" }),
          }),
        ),
      )
      expect(view).toMatchObject({
        turn: 1,
        turnStatus: expectedStatus,
        player: { isReady: true },
        actions: expect.arrayContaining([
          expect.objectContaining({ id: submission.submittedActionTargets.actionId, selectedTargets: null }),
        ]),
      })
      expect(processingOutcome).toBe("processed")
      expect(await creator.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({ turn: 2, resources: { METAL: { total: 2 } } })
    },
  )

  it("should close the Turn when two players lock in concurrently", async () => {
    // Arrange
    await using fixture = await TurnConcurrencyFixture.create()
    const { creator, gameId, otherPlayers } = await createGame(fixture, { nbPlayers: 2 })
    const joiner = otherPlayers[0]
    Assert.isDefined(joiner)
    using readiness = fixture.apiTransactions.pauseNext()

    // Act
    const creatorReadying = Result.tryCatch(creator.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true }))
    await readiness.waitUntilHeld()
    const joinerReadying = Result.tryCatch(joiner.client.gameplay.updateReadiness.mutate({ gameId, turn: 1, isReady: true }))
    const blockedQuery = await fixture.waitUntilBlockedBy(readiness)
    readiness.release()
    const outcomes = await within(Promise.all([creatorReadying, joinerReadying]))
    const view = await creator.client.gameplay.getPlayerView.query({ gameId })
    const worker = fixture.createWorker()
    const processingOutcome = await worker.processNextDueTurn()

    // Assert
    expect(blockedQuery).toContain('from "turns"')
    expect(outcomes).toStrictEqual([Result.Success(undefined), Result.Success(undefined)])
    expect(view).toMatchObject({ turn: 1, turnStatus: TurnStatus.AWAITING_PROCESSING, player: { isReady: true } })
    expect(Object.values(view.opponents)).toStrictEqual([expect.objectContaining({ isReady: true })])
    expect(processingOutcome).toBe("processed")
    expect(await creator.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({ turn: 2, player: { isReady: false } })
    expect(await joiner.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({ turn: 2, player: { isReady: false } })
    expect(await worker.processNextDueTurn()).toBe("idle")
  })
})

async function createGame(
  fixture: TurnConcurrencyFixture,
  { nbPlayers = 1, turnIntervalSeconds = 60 }: { nbPlayers?: number; turnIntervalSeconds?: number } = {},
): Promise<{
  creator: AuthenticatedApiClient
  otherPlayers: AuthenticatedApiClient[]
  gameId: GameId
  submission: Omit<UpdateActionSubmissionDto, "playerId">
}> {
  const creator = await fixture.api.createClient({ authenticated: true })
  const { createdGameId: gameId } = await creator.client.lobbies.create.mutate({
    configuration: createLobbyConfigurationDtoStub({ nbSeats: nbPlayers, turnIntervalSeconds, mapGenerationSeed: 1234 }),
  })
  const otherPlayers = []
  for (let index = 1; index < nbPlayers; index += 1) {
    const player = await fixture.api.createClient({ authenticated: true })
    await player.client.lobbies.join.mutate({ gameId })
    otherPlayers.push(player)
  }
  await creator.client.gameplay.startGame.mutate({ gameId })
  const view = await creator.client.gameplay.getPlayerView.query({ gameId })
  const action = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
  Assert.isDefined(action)
  return {
    creator,
    otherPlayers,
    gameId,
    submission: { gameId, turn: 1, submittedActionTargets: { actionId: action.id, selectedTargets: {} } },
  }
}
