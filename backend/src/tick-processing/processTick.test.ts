import { Assert, Datetime, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { ClockMock } from "#lib/Clock.mock.ts"
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
    const clock = new ClockMock({ startDate: new Date(0) })
    const { api, authService, accountsRepository, logger } = await createApiStub({ db, clock })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new ResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account

    const tickInterval = Time.create(1000, UnitOfTime.SECONDS)
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "process tick", nbSeats: 1, tickIntervalSeconds: Time.in(tickInterval, UnitOfTime.SECONDS) },
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
      configuration: { name: "unaffordable action", nbSeats: 1, tickIntervalSeconds: 0 },
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

  it("should process multiple ticks in the same invocation", async () => {
    // Arrange
    const db = await createDbMock()
    const { api, authService, accountsRepository, logger, clock } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const firstAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = firstAccount
    const { createdGameId: firstGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "first simultaneous tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: firstGameId })

    await processTick({ logger, ticksRepository, clock }) // This will process the first game once, making the assertions different

    const secondAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = secondAccount
    const { createdGameId: secondGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "second simultaneous tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: secondGameId })

    // Act
    await processTick({ logger, ticksRepository, clock })

    // Assert
    authService.account = firstAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: firstGameId })).toMatchObject({
      tick: 2,
      resources: { money: 2 },
    })

    authService.account = secondAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: secondGameId })).toMatchObject({
      tick: 1,
      resources: { money: 1 },
    })
  })

  it("should save other ticks when one tick fails", async () => {
    // Arrange
    const db = await createDbMock()
    const { api, authService, accountsRepository, logger, clock } = await createApiStub({ db })
    using trpcClient = new TrpcClient({ api })

    const failingAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = failingAccount
    const { createdGameId: failingGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "failing simultaneous tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: failingGameId })

    const successfulAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = successfulAccount
    const { createdGameId: successfulGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "successful simultaneous tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: successfulGameId })

    const ticksRepository = new FailingTicksRepository({ db, logger, failingGameId })

    // Act
    await processTick({ logger, ticksRepository, clock })

    // Assert
    authService.account = failingAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: failingGameId })).toMatchObject({
      tick: 0,
      resources: { money: 0 },
    })

    authService.account = successfulAccount
    expect(await trpcClient.client.gameplay.getPlayerView.query({ gameId: successfulGameId })).toMatchObject({
      tick: 1,
      resources: { money: 1 },
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
      configuration: { name: "deterministic winner", nbSeats: 2, tickIntervalSeconds: 0 },
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
    const { api, authService, accountsRepository, logger } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "atomic tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })
    const tickToProcess = extractSuccess(await ticksRepository.getTicksToProcess({ since: new Date() }))[0]
    Assert.isDefined(tickToProcess)

    // Act
    const saveResult = await ticksRepository.saveProcessedTick({
      gameId: tickToProcess.gameId,
      tick: tickToProcess.tick,
      processedAt: new Date(),
      players: {
        ...tickToProcess.players,
        // Unknown player will fail to insert
        [v4()]: {
          resources: [{ resourceType: ResourceType.MONEY, amount: 1 }],
        },
      },
      winnerAccountId: undefined,
      nextTick: {
        tick: tickToProcess.tick + 1,
        scheduledFor: tickToProcess.scheduledFor,
      },
    })

    // Assert
    expect(saveResult).toEqual(Result.Failure(expect.any(String)))
    expect(await ticksRepository.getTicksToProcess({ since: new Date() })).toEqual(Result.Success([tickToProcess]))
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
