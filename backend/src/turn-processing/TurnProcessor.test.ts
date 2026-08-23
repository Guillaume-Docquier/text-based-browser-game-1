import { Assert, Datetime, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createResourcesStub } from "#lib/rules-engine/ruleset-model/mechanics/Resources.stub.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
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
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: secondGameId })

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
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should wait before retrying when the selected turn processing fails", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, clock, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: turnInterval })
      await turnProcessor.processTurnsForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // No turns were processed because turns in error block, this will be resolved by https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/278
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 0,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 0,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })
  })

  describe("processNextDueTurn", () => {
    it("should process the current turn and queue the next one", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, accountsRepository } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })

      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: getAvailableAction(initialPlayerView, GainInfluence.id),
      })

      // Act
      clock.increment({ time: turnInterval })
      await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toEqual<typeof playerView>({
        ...initialPlayerView,
        turn: 1,
        nextTurnAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        resources: createResourcesStub({
          [ResourceType.INFLUENCE]: 8,
          [ResourceType.METAL]: 2,
          [ResourceType.FUEL]: 1,
        }),
        uncommittedResources: createResourcesStub({
          [ResourceType.INFLUENCE]: 8,
          [ResourceType.METAL]: 2,
          [ResourceType.FUEL]: 1,
        }),
        availableActions: expect.any(Array),
      })
    })

    it.each([
      { turnInterval: Time.create(100, UnitOfTime.SECONDS), timeIncrement: Time.create(116, UnitOfTime.SECONDS) },
      { turnInterval: Time.create(100, UnitOfTime.MINUTES), timeIncrement: Time.create(103, UnitOfTime.MINUTES) },
    ])(
      "should schedule the next turn from the current time when the delay exceeds 15 percent of the interval, capped at 2 minutes",
      async ({ turnInterval, timeIncrement }) => {
        // Arrange
        const db = await createDbMock()
        const clock = new ControlledClock({ startDate: new Date(0) })
        using apiServer = new ApiServer(await createApiStub({ db, clock }))
        const player = await apiServer.createClient({ authenticated: true })

        const { createdGameId } = await player.client.lobbies.create.mutate({
          configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
        })
        await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

        const { turnProcessor } = await createTurnProcessorStub({ db, clock })

        // Act
        clock.increment({ time: timeIncrement })
        await turnProcessor.processNextDueTurn()

        // Assert
        expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
          turn: 1,
          nextTurnAt: Datetime.increment({ date: clock.now(), time: turnInterval }).toISOString(),
        })
      },
    )

    it("should fail the turn when a locked action submission is no longer affordable", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, accountsRepository, logger, clock } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: 0 }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: getAvailableAction(initialPlayerView, GainMetal.id),
      })
      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: player.account.id,
          resourceType: ResourceType.INFLUENCE,
          amountDelta: -3,
        }),
      )

      // Act
      const result = await turnProcessor.processNextDueTurn()

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toMatchObject({
        turn: 0,
        resources: {
          [ResourceType.INFLUENCE]: 0,
        },
      })
      expect(result).toBe("failed")
    })

    it("should process only the earliest scheduled turn in one invocation", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      // later game
      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: earlierGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 0,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should be able to process the same turn over time", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      await turnProcessor.processNextDueTurn()

      clock.increment({ time: turnInterval })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 2,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should skip turns that are already processing", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      const processingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: processingGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(processingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: processingGameId })

      // Act
      clock.increment({ time: processingTurnInterval })
      const processingResults = await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(processingResults).toEqual<typeof processingResults>(["processed", "idle"])
      expect(await player.client.gameplay.getPlayerView.query({ gameId: processingGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should not process another turn when the selected turn processing fails", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const failingTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(failingTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: failingGameId })

      const successfulTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(successfulTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: successfulGameId })

      const turnsRepository = new FailingTurnsRepository({ db, logger, clock, failingGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })

      // Act
      clock.increment({ time: successfulTurnInterval })
      await turnProcessor.processNextDueTurn()

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        turn: 0,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        turn: 0,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should be able to process turns in parallel", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const earlierTurnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(earlierTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: earlierGameId })

      const laterTurnInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(laterTurnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: laterGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: laterTurnInterval })

      // if rows are locked correctly, processing 2 turns concurrently should result in 2 different turns being processed
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })

      expect(await player.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should do nothing if there are no turns left when processing turns in parallel", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS) }),
      })
      await player.client.gameplay.startGame.mutate({ gameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })

      // Act
      clock.increment({ time: turnInterval })
      // if rows are locked correctly, processing 2 turns concurrently should result in 1 turn being processed and the other one will do nothing
      await Promise.all([turnProcessor.processNextDueTurn(), turnProcessor.processNextDueTurn()])

      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        turn: 1,
        resources: { [ResourceType.INFLUENCE]: 3 },
      })
    })

    it("should fully process every player and select at most one deterministic winner", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, accountsRepository, logger, clock } = await createApiStub({ db })
      using apiServer = new ApiServer({ api, accountsRepository })
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: 0 }),
      })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const { turnProcessor } = await createTurnProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      for (const { player, amountDelta } of [
        { player: creator, amountDelta: 10 },
        { player: joiner, amountDelta: 12 },
      ]) {
        for (const resourceType of [ResourceType.INFLUENCE, ResourceType.METAL, ResourceType.FUEL, ResourceType.ENERGY]) {
          const updateResourceResult = await resourcesRepository.updateResource({
            gameId: createdGameId,
            playerId: player.account.id,
            resourceType,
            amountDelta,
          })
          Assert.isSuccess(updateResourceResult)
        }
        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

        await player.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          turn: 0,
          actionSubmission: getAvailableAction(playerView, WinTheGame.id),
        })
      }

      // Act
      await turnProcessor.processNextDueTurn()

      // Assert
      // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
      const expectedWinnerId = [creator.account.id, joiner.account.id].sort()[0]

      const lobby = await creator.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby).toMatchObject({
        winnerAccountId: expectedWinnerId,
        endedAt: expect.any(String),
      })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(creatorView).toMatchObject({
        resources: {
          [ResourceType.INFLUENCE]: 3,
        },
      })

      const joinerView = await joiner.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        resources: {
          [ResourceType.INFLUENCE]: 5,
        },
      })
    })

    it("should not do anything in case of failure", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, accountsRepository, logger } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ turnIntervalSeconds: 0 }),
      })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        turn: 0,
        actionSubmission: getAvailableAction(playerView, GainInfluence.id),
      })

      const turnsRepository = new FailingTurnsRepository({ db, logger, clock, failingGameId: createdGameId })
      const { turnProcessor } = await createTurnProcessorStub({ db, clock, turnsRepository })
      const turnToProcess = { gameId: createdGameId, turn: 0 }

      // Act
      const failedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterFailedSave = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      turnsRepository.shouldFail = false
      await turnsRepository.resetProcessingAttempt(turnToProcess)
      const retriedProcessingResult = await turnProcessor.processNextDueTurn()
      const playerViewAfterRetry = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(failedProcessingResult).toBe("failed")
      expect(playerViewAfterFailedSave).toMatchObject({
        turn: 0,
        resources: {
          [ResourceType.INFLUENCE]: 3,
        },
      })
      expect(retriedProcessingResult).toBe("processed")
      expect(playerViewAfterRetry).toMatchObject({
        turn: 1,
        resources: {
          [ResourceType.INFLUENCE]: 8,
        },
      })
    })
  })
})

function getAvailableAction<TPlayerView extends { availableActions: ReadonlyArray<{ actionDefinitionId: string }> }>(
  playerView: TPlayerView,
  actionDefinitionId: string,
): TPlayerView["availableActions"][number] {
  const action = playerView.availableActions.find((availableAction) => availableAction.actionDefinitionId === actionDefinitionId)
  Assert.isDefined(action)
  return action
}

class FailingTurnsRepository extends TurnsRepository {
  private readonly failingGameId: number

  public shouldFail = true

  public constructor({
    db,
    logger,
    clock,
    failingGameId,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger, clock })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTurn(processedTurn: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    if (processedTurn.gameId === this.failingGameId && this.shouldFail) {
      return Result.Failure("Expected turn save failure")
    }

    return await super.saveProcessedTurn(processedTurn)
  }
}
