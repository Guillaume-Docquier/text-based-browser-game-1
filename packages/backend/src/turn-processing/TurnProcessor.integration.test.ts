import { Datetime, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { afterEach, describe, expect, vi, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"
import { readTurnState } from "#testing/readTurnState.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { type ProcessedTurnModel, TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("TurnProcessor", () => {
  describe("processTurnsForever", () => {
    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    it("should process all currently due turns before waiting", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.games.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: secondGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      expect(await player.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
        turn: 2,
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        turn: 2,
      })
    })

    it("should wait before retrying when the selected turn processing fails", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = createApiStub({ db, clock })
      await using apiServer = await ApiServer.create({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
      })
    })
  })

  describe("processNextDueTurn", () => {
    it("should process the current turn and queue the next one", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      const { api, accountsRepository } = createApiStub({ db, clock })
      await using apiServer = await ApiServer.create({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        turn: 2,
      })
      expect((await readTurnState(player, createdGameId)).turnEndsAt).toBe(
        Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
      )
    })

    it.each([
      {
        schedule: "from closure time when the delay is below the threshold",
        turnIntervalSeconds: 100,
        elapsedSeconds: 110,
        expectedDeadline: "2026-01-01T00:03:20.000Z",
      },
      {
        schedule: "from closure time when the delay equals the threshold",
        turnIntervalSeconds: 100,
        elapsedSeconds: 115,
        expectedDeadline: "2026-01-01T00:03:20.000Z",
      },
      {
        schedule: "from processing time when the delay exceeds 15 percent of the interval",
        turnIntervalSeconds: 100,
        elapsedSeconds: 116,
        expectedDeadline: "2026-01-01T00:03:36.000Z",
      },
      {
        schedule: "from processing time when the delay exceeds the two-minute cap",
        turnIntervalSeconds: 6000,
        elapsedSeconds: 6180,
        expectedDeadline: "2026-01-01T03:23:00.000Z",
      },
    ])("should schedule the next turn $schedule", async ({ turnIntervalSeconds, elapsedSeconds, expectedDeadline }) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock({ startDate: new Date("2026-01-01T00:00:00.000Z") })
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds, mapGenerationSeed: 123 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(elapsedSeconds, UnitOfTime.SECONDS) })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await readTurnState(player, createdGameId)).toMatchObject({
        turn: 2,
        turnEndsAt: expectedDeadline,
      })
    })

    it("should process only the earliest scheduled turn in one invocation", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: laterGameId })

      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: earlierGameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 1,
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 2,
      })
    })

    it("should be able to process the same turn over time", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      await using apiServer = await ApiServer.create(createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      clock.increment({ time: turnInterval })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 3,
      })
    })

    it("should not process another turn when the selected turn processing fails", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = createApiStub({ db, clock })
      await using apiServer = await ApiServer.create({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const failingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.games.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      clock.increment({ time: successfulTurnInterval })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 1,
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 1,
      })
    })

    it("should not do anything in case of failure", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      const clock = new ControlledClock()
      const { api, accountsRepository, logger } = createApiStub({ db, clock })
      await using apiServer = await ApiServer.create({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, failingGameId: createdGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })
      const turnToProcess = { gameId: createdGameId, turn: 1 }

      // Act
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.moveDueTurnsToAwaitingProcessing({ since: clock.now() })
      const failedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterFailedSave = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      turnsRepository.shouldFail = false
      await turnsRepository.resetProcessingAttempt(turnToProcess)
      const retriedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterRetry = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(failedProcessingResult).toBe("failed")
      expect(playerViewAfterFailedSave).toMatchObject({
        turn: 1,
      })
      expect(retriedProcessingResult).toBe("processed")
      expect(playerViewAfterRetry).toMatchObject({
        turn: 2,
      })
    })
  })
})

class FailingTurnsRepository extends TurnsRepository {
  private readonly failingGameId: number

  public shouldFail = true

  public constructor({
    db,
    logger,
    failingGameId,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTurn(processedTurn: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    if (processedTurn.gameId === this.failingGameId && this.shouldFail) {
      return Result.Failure("Expected turn save failure")
    }

    return await super.saveProcessedTurn(processedTurn)
  }
}
