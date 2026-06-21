import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { NewStarSystemModel, StarSystemModel } from "#api/gameplay/star-systems/StarSystemModels.ts"
import { StarSystemQueries } from "#api/gameplay/star-systems/StarSystemQueries.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/gameplay/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, gameStatesTable, ordersTable, playersTable, resourcesTable, ticksTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type OrderRow = typeof ordersTable.$inferSelect
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTickRow = typeof ticksTable.$inferInsert

export type OrderModel = OrderRow

export type PlayerViewModel = {
  gameId: number
  playerId: PlayerId
  tick: number
  nextTickAt: Date
  starSystem: StarSystemModel
  resources: {
    money: number
  }
}

export type StartGameContextModel = {
  gameId: GameId
  status: GameStatus
  creatorPlayerId: PlayerId
  tickIntervalSeconds: number
  starSystemGenerationSettings: (typeof gamesTable.$inferSelect)["starSystemGenerationSettings"]
  playerIds: PlayerId[]
}

export type GamePlayerContextModel = {
  status: GameStatus
  hasPlayerJoined: boolean
  tick: number | undefined
  money: number | undefined
}

export type StartGameModel = {
  gameId: GameId
  startedAt: Date
  nextTickAt: Date
  starSystem: NewStarSystemModel
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
    }
  >
}

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger
  private readonly clock: Clock

  public constructor({ logger, db, clock }: { logger: Logger; db: PostgresRepository["db"]; clock: Clock }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
    this.clock = clock
  }

  public async getStartGameContextForMutation(
    { gameId }: { gameId: GameId },
    tx: Transaction,
  ): Promise<Result<StartGameContextModel | undefined, string>> {
    const contextResult = await Result.tryCatch(async () => {
      const games = await tx
        .select({
          gameId: gamesTable.id,
          status: gamesTable.status,
          creatorPlayerId: gamesTable.createdByAccountId,
          tickIntervalSeconds: gamesTable.tickIntervalSeconds,
          starSystemGenerationSettings: gamesTable.starSystemGenerationSettings,
        })
        .from(gamesTable)
        .where(eq(gamesTable.id, gameId))
        .for("update")
      Assert.isTrue(games.length <= 1)

      const game = games[0]
      if (game === undefined) {
        return undefined
      }

      const players = await tx.select({ playerId: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId))
      return {
        ...game,
        playerIds: players.map(({ playerId }) => playerId),
      }
    })

    if (Result.isFailure(contextResult)) {
      this.logger.error("Could not get locked game start context", { gameId, error: contextResult.error })
      return Result.Failure(couldNot("get locked game start context"))
    }

    return contextResult
  }

  public async hasPlayerJoinedGame(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const result = await Result.tryCatch(async () => {
      const players = await db
        .select({ playerId: playersTable.playerId })
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, playerId)))
      Assert.isTrue(players.length <= 1)
      return players.length === 1
    })

    if (Result.isFailure(result)) {
      this.logger.error("Could not check if player joined game", { gameId, playerId, error: result.error })
      return Result.Failure(couldNot("check if player joined game"))
    }

    return result
  }

  public async getGamePlayerContext(
    params: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerContextModel | undefined, string>> {
    return await this.getGamePlayerContextWithLock(params, db, false)
  }

  public async getGamePlayerContextForMutation(
    params: { gameId: GameId; playerId: PlayerId },
    tx: Transaction,
  ): Promise<Result<GamePlayerContextModel | undefined, string>> {
    return await this.getGamePlayerContextWithLock(params, tx, true)
  }

  private async getGamePlayerContextWithLock(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"],
    lock: boolean,
  ): Promise<Result<GamePlayerContextModel | undefined, string>> {
    const contextResult = await Result.tryCatch(async () => {
      const gameQuery = db.select({ status: gamesTable.status }).from(gamesTable).where(eq(gamesTable.id, gameId))
      const games = lock ? await gameQuery.for("update") : await gameQuery
      Assert.isTrue(games.length <= 1)

      const game = games[0]
      if (game === undefined) {
        return undefined
      }

      const players = await db
        .select({ playerId: playersTable.playerId })
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, playerId)))
      Assert.isTrue(players.length <= 1)
      if (players.length === 0) {
        return { status: game.status, hasPlayerJoined: false, tick: undefined, money: undefined }
      }

      const gameStates = await db.select({ tick: gameStatesTable.tick }).from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId))
      Assert.isTrue(gameStates.length <= 1)
      const moneyResources = await db
        .select({ amount: resourcesTable.amount })
        .from(resourcesTable)
        .where(
          and(
            eq(resourcesTable.gameId, gameId),
            eq(resourcesTable.playerId, playerId),
            eq(resourcesTable.resourceType, ResourceType.MONEY),
          ),
        )
      Assert.isTrue(moneyResources.length <= 1)

      return {
        status: game.status,
        hasPlayerJoined: true,
        tick: gameStates[0]?.tick,
        money: moneyResources[0]?.amount,
      }
    })

    if (Result.isFailure(contextResult)) {
      this.logger.error("Could not get game player context", { gameId, playerId, lock, error: contextResult.error })
      return Result.Failure(couldNot("get game player context"))
    }

    return contextResult
  }

  public async startGame(startGameModel: StartGameModel, tx: Transaction): Promise<Result<{ nextTickAt: Date }, string>> {
    const gameState = {
      gameId: startGameModel.gameId,
      tick: 0,
      nextTickAt: startGameModel.nextTickAt,
    } as const satisfies NewGameStateRow

    const playerResources: NewResourceRow[] = Object.entries(startGameModel.players).flatMap(([playerId, { resources }]) =>
      resources.map((resource) => ({
        gameId: startGameModel.gameId,
        playerId,
        ...resource,
      })),
    )
    Assert.isTrue(playerResources.length > 0)

    const gameTick: NewTickRow = {
      gameId: startGameModel.gameId,
      tick: gameState.tick,
      scheduledFor: startGameModel.nextTickAt,
    }

    const startResult = await Result.tryCatch(async () => {
      await tx
        .update(gamesTable)
        .set({ status: GameStatus.STARTED, startedAt: startGameModel.startedAt })
        .where(eq(gamesTable.id, startGameModel.gameId))
      await tx.insert(gameStatesTable).values(gameState)
      await tx.insert(resourcesTable).values(playerResources)
      await tx.insert(ticksTable).values(gameTick)
      await StarSystemQueries.insertStarSystem({ gameId: startGameModel.gameId, starSystem: startGameModel.starSystem }, tx)
    })

    if (Result.isFailure(startResult)) {
      this.logger.error("Could not start game", { startGameModel, error: startResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return Result.Success({ nextTickAt: gameState.nextTickAt })
  }

  public async getPlayerView(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerViewModel | undefined, string>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const gameStates = await tx.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId))
        Assert.isTrue(gameStates.length === 1)

        const gameState = gameStates[0]
        if (gameState === undefined) {
          return undefined
        }

        const starSystem = await StarSystemQueries.selectStarSystem(gameId, tx)

        const playerResources = await tx
          .select()
          .from(resourcesTable)
          .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money)

        return {
          ...gameState,
          playerId,
          starSystem,
          resources: {
            money: money.amount,
          },
        }
      }),
    )

    if (Result.isFailure(playerViewResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerViewResult.error })
      return Result.Failure(couldNot("get player game state by ids"))
    }

    return playerViewResult
  }

  public async getCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  public async setCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number; actionType: GamePlayerActionType },
    tx: Transaction,
  ): Promise<Result<OrderModel, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = this.clock.now()
      const gamePlayerActions = await tx
        .insert(ordersTable)
        .values({ ...params, updatedAt })
        .onConflictDoUpdate({
          target: [ordersTable.gameId, ordersTable.playerId, ordersTable.tick],
          set: {
            actionType: params.actionType,
            updatedAt,
          },
        })
        .returning()

      Assert.isTrue(gamePlayerActions.length === 1)
      Assert.isDefined(gamePlayerActions[0])

      return gamePlayerActions[0]
    })

    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not upsert game player action", { ...params, error: upsertResult.error })
      return Result.Failure(couldNot("upsert game player action"))
    }

    return upsertResult
  }

  public async clearCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    tx: Transaction,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      tx
        .delete(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player action"))
    }

    return Result.Success(true)
  }
}
