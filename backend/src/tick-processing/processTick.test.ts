import { Assert, Datetime, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
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
import { processTick } from "#tick-processing/processTick.ts"
import { type ProcessedTickModel, TicksRepository } from "#tick-processing/ticks.repository.ts"

describe("processTick", () => {
  it("should process the current tick and queue the next one", async () => {
    // Arrange
    const db = await createDbMock()
    const clock = new ControlledClock({ startDate: new Date(0) })
    const { api, authService, accountsRepository, logger } = await createApiStub({ db, clock })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new ResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account

    const tickInterval = Time.create(1000, UnitOfTime.SECONDS)
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) }),
    })

    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

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
    await processTick({ logger, ticksRepository, clock })

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
    const { api, authService, accountsRepository, logger, clock } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new ResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

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
    await processTick({ logger, ticksRepository, clock })

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
    const { api, authService, accountsRepository, logger } = await createApiStub({ db, clock })
    const ticksRepository = new TicksRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    // later game
    const laterTickInterval = Time.create(100, UnitOfTime.SECONDS)
    const laterAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = laterAccount
    const { createdGameId: laterGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(laterTickInterval, UnitOfTime.SECONDS) }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: laterGameId })

    // earlier game
    const earlierTickInterval = Time.create(50, UnitOfTime.SECONDS)
    const earlierAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = earlierAccount
    const { createdGameId: earlierGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(earlierTickInterval, UnitOfTime.SECONDS) }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: earlierGameId })

    // Act
    clock.increment({ time: Time.create(200, UnitOfTime.SECONDS) })
    await processTick({ logger, ticksRepository, clock })

    // Assert
    authService.account = laterAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: laterGameId })).toMatchObject({
      tick: 0,
      resources: { money: 0 },
    })

    authService.account = earlierAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: earlierGameId })).toMatchObject({
      tick: 1,
      resources: { money: 1 },
    })
  })

  it("should not process a later tick when the selected tick fails", async () => {
    // Arrange
    const db = await createDbMock()
    const clock = new ControlledClock({ startDate: new Date(0) })
    const { api, authService, accountsRepository, logger } = await createApiStub({ db, clock })
    using trpcClient = new TrpcClient({ api })

    const earlierTickInterval = Time.create(50, UnitOfTime.SECONDS)
    const failingAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = failingAccount
    const { createdGameId: failingGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(earlierTickInterval, UnitOfTime.SECONDS) }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: failingGameId })

    const laterTickInterval = Time.create(100, UnitOfTime.SECONDS)
    const successfulAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = successfulAccount
    const { createdGameId: successfulGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: Time.in(laterTickInterval, UnitOfTime.SECONDS) }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: successfulGameId })

    const ticksRepository = new FailingTicksRepository({ db, logger, failingGameId })

    // Act
    clock.increment({ time: laterTickInterval })
    await processTick({ logger, ticksRepository, clock })

    // Assert
    authService.account = failingAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
      tick: 0,
      resources: { money: 0 },
    })

    authService.account = successfulAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
      tick: 0,
      resources: { money: 0 },
    })
  })

  it("should fully process every player and select at most one deterministic winner", async () => {
    // Arrange
    const db = await createDbMock()
    const { api, authService, accountsRepository, logger, clock } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new ResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = creator
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
    })

    const joiner = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = joiner
    await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })

    authService.account = creator
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

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

      authService.account = player
      await trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.WIN_THE_GAME,
      })
    }

    // Act
    await processTick({ logger, ticksRepository, clock })

    // Assert
    // Eventually we'll have a turn order that will change during the game, for now the players are sorted by their id
    const expectedWinnerId = [creator.id, joiner.id].sort()[0]

    const lobby = await trpcClient.client.lobbies.getById.query({ gameId: createdGameId })
    expect(lobby).toMatchObject({
      winnerAccountId: expectedWinnerId,
      endedAt: expect.any(String),
    })

    authService.account = creator
    const creatorView = await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(creatorView).toMatchObject({
      resources: {
        money: 1,
      },
    })

    authService.account = joiner
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
    const { api, authService, accountsRepository, logger } = await createApiStub({ db, clock })
    const ticksRepository = new InvalidPlayerTicksRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: createGameConfigurationDtoStub({ tickIntervalSeconds: 0 }),
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })
    const tickToProcess = extractSuccess(await ticksRepository.getNextTickToProcess({ since: clock.now() }))
    Assert.isDefined(tickToProcess)

    // Act
    await processTick({ logger, ticksRepository, clock })

    // Assert
    expect(await ticksRepository.getNextTickToProcess({ since: clock.now() })).toEqual(Result.Success(tickToProcess))
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toMatchObject({
      tick: 0,
      resources: {
        money: 0,
      },
    })
  })
})

class FailingTicksRepository extends TicksRepository {
  private readonly failingGameId: number

  public constructor({
    db,
    logger,
    failingGameId,
  }: ConstructorParameters<typeof TicksRepository>[0] & {
    failingGameId: number
  }) {
    super({ db, logger })
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
