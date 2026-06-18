import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { NewStarSystemModel, StarSystemModel } from "#api/gameplay/star-systems/StarSystemModels.ts"
import { StarSystemQueries } from "#api/gameplay/star-systems/StarSystemQueries.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, gameStatesTable, ordersTable, resourcesTable, ticksTable } from "#lib/db/schema.ts"
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

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
  }

  public async startGame(
    startGameModel: StartGameModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ nextTickAt: Date }, string>> {
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

    const startResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await tx.update(gamesTable).set({ startedAt: startGameModel.startedAt }).where(eq(gamesTable.id, startGameModel.gameId))
        await tx.insert(gameStatesTable).values(gameState)
        await tx.insert(resourcesTable).values(playerResources)
        await tx.insert(ticksTable).values(gameTick)
        await StarSystemQueries.insertStarSystem({ gameId: startGameModel.gameId, starSystem: startGameModel.starSystem }, tx)
      }),
    )

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
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = new Date()
      const gamePlayerActions = await db
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
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      db
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
