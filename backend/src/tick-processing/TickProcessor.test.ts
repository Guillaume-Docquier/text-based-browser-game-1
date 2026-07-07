import { Assert, Datetime, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createTickProcessorStub } from "#tick-processing/TickProcessor.stub.ts"
import { type ProcessedTickModel, TicksRepository } from "#tick-processing/ticks.repository.ts"

describe("TickProcessor", () => {
  describe("processTicksForever", () => {
    afterEach(() => {
      vi.clearAllTimers()
      vi.useRealTimers()
    })

    it("should process all currently due ticks before waiting", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const tickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: firstGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) / 2 }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: firstGameId })

      const { createdGameId: secondGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: secondGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: tickInterval })
      await tickProcessor.processTicksForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // Processed twice because the tick interval was smaller than the increment
      // Simulates a catch-up
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
        tick: 2,
        resources: { money: 2 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })
    })

    it("should wait before retrying when the selected tick processing fails", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository, logger } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const tickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: failingGameId })

      const { createdGameId: successfulGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: successfulGameId })

      const ticksRepository = new FailingTicksRepository({ db, logger, clock, failingGameId })
      const { tickProcessor } = await createTickProcessorStub({ db, clock, ticksRepository })

      // Act
      vi.useFakeTimers()
      clock.increment({ time: tickInterval })
      await tickProcessor.processTicksForever({ interval: Time.create(1, UnitOfTime.SECONDS) })

      // Assert
      expect(vi.getTimerCount()).toBe(1)
      vi.clearAllTimers()
      vi.useRealTimers()

      // No ticks were processed because ticks in error block, this will be resolved by https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/278
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })
    })
  })

  describe("processNextDueTick", () => {
    it("should process the current tick and queue the next one", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository, logger } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authAdapter.account = account

      const tickInterval = Time.create(1000, UnitOfTime.SECONDS)
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })

      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      const updateResourceResult = await resourcesRepository.updateResource({
        gameId: createdGameId,
        playerId: account.id,
        resourceType: ResourceType.MONEY,
        amountDelta: 2,
      })
      Assert.isSuccess(updateResourceResult)

      await trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })

      // Act
      clock.increment({ time: tickInterval })
      await tickProcessor.processNextDueTick()

      // Assert
      const playerView = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toEqual<typeof playerView>({
        gameId: createdGameId,
        playerId: account.id,
        tick: 1,
        nextTickAt: Datetime.increment({ date: clock.now(), time: tickInterval }).toISOString(),
        starSystem: expect.any(Object),
        resources: {
          money: 6,
        },
      })
    })

    it("should not apply an action when the player cannot afford it", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, authAdapter, accountsRepository, logger, clock } = await createApiStub({ db })
      using trpcClient = new TrpcClient({ api })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authAdapter.account = account
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: account.id,
          resourceType: ResourceType.MONEY,
          amountDelta: 2,
        }),
      )
      await trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      Assert.isSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: account.id,
          resourceType: ResourceType.MONEY,
          amountDelta: -2,
        }),
      )

      // Act
      await tickProcessor.processNextDueTick()

      // Assert
      const playerView = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toMatchObject({
        tick: 1,
        resources: {
          money: 1,
        },
      })
    })

    it("should process only the earliest scheduled tick in one invocation", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      // later game
      const laterTickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(laterTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: laterGameId })

      // earlier game
      const earlierTickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(earlierTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: earlierGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })

      // Act
      clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
      await tickProcessor.processNextDueTick()

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })
    })

    it("should be able to process the same tick over time", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const tickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })

      // Act
      clock.increment({ time: tickInterval })
      await tickProcessor.processNextDueTick()

      clock.increment({ time: tickInterval })
      await tickProcessor.processNextDueTick()

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        tick: 2,
        resources: { money: 2 },
      })
    })

    it("should skip ticks that are already processing", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { tickProcessor, ticksRepository } = await createTickProcessorStub({ db, clock })

      const processingTickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: processingGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(processingTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: processingGameId })
      await ticksRepository.startProcessingTick({ gameId: processingGameId, tick: 0 })

      const notProcessingTickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: notProcessingGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(notProcessingTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: notProcessingGameId })

      // Act
      clock.increment({ time: notProcessingTickInterval })
      await tickProcessor.processNextDueTick()

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: processingGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: notProcessingGameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })
    })

    it("should not process another tick when the selected tick processing fails", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository, logger } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const failingTickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: failingGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(failingTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: failingGameId })

      const successfulTickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: successfulGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(successfulTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: successfulGameId })

      const ticksRepository = new FailingTicksRepository({ db, logger, clock, failingGameId })
      const { tickProcessor } = await createTickProcessorStub({ db, clock, ticksRepository })

      // Act
      clock.increment({ time: successfulTickInterval })
      await tickProcessor.processNextDueTick()

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
        tick: 0,
        resources: { money: 0 },
      })
    })

    it("should be able to process ticks in parallel", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const earlierTickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: earlierGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(earlierTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: earlierGameId })

      const laterTickInterval = Time.create(100, UnitOfTime.SECONDS)
      const { createdGameId: laterGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(laterTickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: laterGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })

      // Act
      clock.increment({ time: laterTickInterval })

      // if rows are locked correctly, processing 2 ticks concurrently should result in 2 different ticks being processed
      await Promise.all([tickProcessor.processNextDueTick(), tickProcessor.processNextDueTick()])

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })

      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })
    })

    it("should do nothing if there are no ticks left when processing ticks in parallel", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const tickInterval = Time.create(50, UnitOfTime.SECONDS)
      const { createdGameId: gameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })

      // Act
      clock.increment({ time: tickInterval })
      // if rows are locked correctly, processing 2 ticks concurrently should result in 1 tick being processed and the other one will do nothing
      await Promise.all([tickProcessor.processNextDueTick(), tickProcessor.processNextDueTick()])

      // Assert
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId })).toMatchObject({
        tick: 1,
        resources: { money: 1 },
      })
    })

    it("should fully process every player and select at most one deterministic winner", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, authAdapter, accountsRepository, logger, clock } = await createApiStub({ db })
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authAdapter.account = creator
      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
      })

      const joiner = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      authAdapter.account = joiner
      await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

      authAdapter.account = creator
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const { tickProcessor } = await createTickProcessorStub({ db, clock })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      for (const { player, amountDelta } of [
        { player: creator, amountDelta: 10 },
        { player: joiner, amountDelta: 12 },
      ]) {
        const updateResourceResult = await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: player.id,
          resourceType: ResourceType.MONEY,
          amountDelta,
        })
        Assert.isSuccess(updateResourceResult)

        authAdapter.account = player
        await trpcClient.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 0,
          actionType: GamePlayerActionType.WIN_THE_GAME,
        })
      }

      // Act
      await tickProcessor.processNextDueTick()

      // Assert
      // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
      const expectedWinnerId = [creator.id, joiner.id].sort()[0]

      const lobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })
      expect(lobby).toMatchObject({
        winnerAccountId: expectedWinnerId,
        endedAt: expect.any(String),
      })

      authAdapter.account = creator
      const creatorView = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(creatorView).toMatchObject({
        resources: {
          money: 1,
        },
      })

      authAdapter.account = joiner
      const joinerView = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(joinerView).toMatchObject({
        resources: {
          money: 3,
        },
      })
    })

    it("should not do anything in case of failure", async () => {
      // Arrange
      const db = await createDbMock()
      const clock = new ControlledClock({ startDate: new Date(0) })
      const { api, authAdapter, accountsRepository, logger } = await createApiStub({ db, clock })
      using trpcClient = new TrpcClient({ api })

      authAdapter.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
      })
      await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

      const ticksRepository = new InvalidPlayerTicksRepository({ db, logger, clock })
      const { tickProcessor } = await createTickProcessorStub({ db, clock, ticksRepository })

      const tickToProcess = extractSuccess(await ticksRepository.getNextTickToProcess({ since: clock.now() }))
      Assert.isDefined(tickToProcess)

      // Act
      await tickProcessor.processNextDueTick()

      // Assert
      await ticksRepository.resetProcessingAttempt(tickToProcess) // This enables getNextTickToProcess to find the tick
      expect(await ticksRepository.getNextTickToProcess({ since: clock.now() })).toEqual(Result.Success(tickToProcess))
      expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
        tick: 0,
        resources: {
          money: 0,
        },
      })
    })
  })
})

class FailingTicksRepository extends TicksRepository {
  private readonly failingGameId: number

  public constructor({
    db,
    logger,
    clock,
    failingGameId,
  }: ConstructorParameters<typeof TicksRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger, clock })
    this.failingGameId = failingGameId
  }

  public override async saveProcessedTick(processedTick: ProcessedTickModel): Promise<Result<{ saved: true }, string>> {
    if (processedTick.gameId === this.failingGameId) {
      return Result.Failure("Expected tick save failure")
    }

    return await super.saveProcessedTick(processedTick)
  }
}

class InvalidPlayerTicksRepository extends TicksRepository {
  public override async saveProcessedTick(processedTick: ProcessedTickModel): Promise<Result<{ saved: true }, string>> {
    return await super.saveProcessedTick({
      ...processedTick,
      players: {
        ...processedTick.players,
        // Unknown player will fail to insert
        [v4()]: {
          resources: [{ resourceType: ResourceType.MONEY, amount: 1 }],
        },
      },
    })
  }
}
