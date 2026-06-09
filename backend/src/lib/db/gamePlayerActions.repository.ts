import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { GameId } from "#api/games/GameId.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"
import { couldNot } from "#lib/errors.ts"
import { type GamePlayerActionType } from "#lib/gamePlayerActionType.ts"
import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerActionsTable } from "./schema.ts"

type GamePlayerActionRow = typeof gamePlayerActionsTable.$inferSelect

export type GamePlayerActionModel = GamePlayerActionRow

/**
 * @deprecated To be replaced by better repositories
 */
export class GamePlayerActionsRepository extends PostgresRepository {
  private readonly logger: Logger

  /**
   * @deprecated To be replaced by better repositories
   */
  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-actions-repository" })
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async upsert(
    params: {
      gameId: GameId
      playerId: PlayerId
      tick: number
      actionType: GamePlayerActionType
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionModel, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = new Date()
      const gamePlayerActions = await db
        .insert(gamePlayerActionsTable)
        .values({ ...params, updatedAt })
        .onConflictDoUpdate({
          target: [gamePlayerActionsTable.gameId, gamePlayerActionsTable.playerId, gamePlayerActionsTable.tick],
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

  /**
   * @deprecated To be replaced by better repositories
   */
  public async getByGameIdPlayerIdAndTick(
    params: {
      gameId: GameId
      playerId: PlayerId
      tick: number
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(gamePlayerActionsTable)
        .where(
          and(
            eq(gamePlayerActionsTable.gameId, params.gameId),
            eq(gamePlayerActionsTable.playerId, params.playerId),
            eq(gamePlayerActionsTable.tick, params.tick),
          ),
        ),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async getByGameIdAndTick(
    params: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionModel[], string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(gamePlayerActionsTable)
        .where(and(eq(gamePlayerActionsTable.gameId, params.gameId), eq(gamePlayerActionsTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player actions by tick", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player actions by tick"))
    }

    return Result.Success(getResult.value)
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async deleteByGameIdPlayerIdAndTick(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(async (): Promise<true> => {
      await db
        .delete(gamePlayerActionsTable)
        .where(
          and(
            eq(gamePlayerActionsTable.gameId, params.gameId),
            eq(gamePlayerActionsTable.playerId, params.playerId),
            eq(gamePlayerActionsTable.tick, params.tick),
          ),
        )

      return true
    })

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player action"))
    }

    return deleteResult
  }
}
