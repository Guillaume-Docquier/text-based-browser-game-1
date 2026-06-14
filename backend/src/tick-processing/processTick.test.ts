import { Result } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { GamePlayerResourcesRepository } from "#lib/db/gameplay/gamePlayerResources.repository.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { processTick } from "#tick-processing/processTick.ts"
import { TicksRepository } from "#tick-processing/ticks.repository.ts"

describe("processTick", () => {
  it("should load, process, and save a tick through the ticks repository", async () => {
    // Arrange
    const db = await createDbMock()
    const { api, authService, accountsRepository, logger } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new GamePlayerResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    authService.account = account
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "process tick", nbSeats: 1, tickIntervalSeconds: 0 },
    })
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })
    extractSuccess(
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

    // Act
    await processTick({ logger, ticksRepository })

    // Assert
    await expect(trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })).resolves.toEqual({
      gameId: createdGameId,
      playerId: account.id,
      tick: 1,
      nextTickAt: expect.any(String),
      resources: {
        money: 6,
      },
    })
  })

  it("should fully process every player and select at most one deterministic winner", async () => {
    // Arrange
    const db = await createDbMock()
    const { api, authService, accountsRepository, logger } = await createApiStub({ db })
    const ticksRepository = new TicksRepository({ db, logger })
    const resourcesRepository = new GamePlayerResourcesRepository({ db, logger })
    using trpcClient = new TrpcClient({ api })

    const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
    const joiner = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Joiner" })))
    authService.account = creator
    const { createdGameId } = await trpcClient.client.lobbies.create.mutate({
      configuration: { name: "deterministic winner", nbSeats: 2, tickIntervalSeconds: 0 },
    })
    authService.account = joiner
    await trpcClient.client.lobbies.join.mutate({ gameId: createdGameId })
    authService.account = creator
    await trpcClient.client.gameplay.startGame.mutate({ gameId: createdGameId })

    for (const account of [creator, joiner]) {
      extractSuccess(
        await resourcesRepository.updateResource({
          gameId: createdGameId,
          playerId: account.id,
          resourceType: ResourceType.MONEY,
          amountDelta: 10,
        }),
      )
      authService.account = account
      await trpcClient.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.WIN_THE_GAME,
      })
    }

    // Act
    await processTick({ logger, ticksRepository })

    // Assert
    const expectedWinnerId = [creator.id, joiner.id].sort()[0]
    authService.account = creator
    await expect(trpcClient.client.lobbies.getById.query({ gameId: createdGameId })).resolves.toMatchObject({
      winnerAccountId: expectedWinnerId,
      endedAt: expect.any(String),
    })

    for (const account of [creator, joiner]) {
      authService.account = account
      await expect(trpcClient.client.gameplay.getPlayerView.query({ gameId: createdGameId })).resolves.toMatchObject({
        resources: {
          money: 1,
        },
      })
    }
  })

  it("should roll back the complete write when any part cannot be persisted", async () => {
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
    const tickToProcess = extractSuccess(await ticksRepository.getTicksToProcess())[0]
    expect(tickToProcess).toBeDefined()
    if (tickToProcess === undefined) {
      return
    }

    // Act
    const saveResult = await ticksRepository.saveProcessedTick({
      gameId: tickToProcess.gameId,
      tick: tickToProcess.tick,
      processedAt: new Date(),
      players: [
        ...tickToProcess.players,
        {
          playerId: v4(),
          resources: [{ resourceType: ResourceType.MONEY, amount: 1 }],
        },
      ],
      winnerAccountId: undefined,
      nextTick: {
        tick: tickToProcess.tick + 1,
        scheduledFor: tickToProcess.scheduledFor,
      },
    })

    // Assert
    expect(saveResult).toEqual(Result.Failure("Could not save processed tick, see logs for more details."))
    expect(await ticksRepository.getTicksToProcess()).toEqual(
      Result.Success([
        {
          ...tickToProcess,
          players: [
            {
              playerId: account.id,
              resources: [{ resourceType: ResourceType.MONEY, amount: 0 }],
              actionType: undefined,
            },
          ],
        },
      ]),
    )
  })
})
