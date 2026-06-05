import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerActionsTable } from "./schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import { type GamePlayerActionType } from "#lib/gamePlayerActions.ts"

export type GamePlayerActionRow = typeof gamePlayerActionsTable.$inferSelect

export class GamePlayerActionsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-actions-repository" })
  }

  public async upsert(
    params: {
      gameId: number
      playerId: number
      tick: number
      actionType: GamePlayerActionType
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionRow, string>> {
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

  public async getByGameIdPlayerIdAndTick(
    params: {
      gameId: number
      playerId: number
      tick: number
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionRow | null, string>> {
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

  public async getByGameIdAndTick(
    params: { gameId: number; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionRow[], string>> {
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

  public async deleteByGameIdPlayerIdAndTick(
    params: { gameId: number; playerId: number; tick: number },
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
