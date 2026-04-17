import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerActionsTable } from "./schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import { type GamePlayerActionType } from "#lib/gamePlayerActions.ts"

export type GamePlayerActionRow = Omit<typeof gamePlayerActionsTable.$inferSelect, "actionType"> & {
  actionType: GamePlayerActionType
}

function toGamePlayerActionRow(gamePlayerActionRow: typeof gamePlayerActionsTable.$inferSelect): GamePlayerActionRow {
  return {
    ...gamePlayerActionRow,
    actionType: gamePlayerActionRow.actionType as GamePlayerActionType,
  }
}

export class GamePlayerActionsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-actions-repository" })
  }

  public async upsert(params: {
    gameId: number
    playerId: number
    tick: number
    actionType: GamePlayerActionType
  }): Promise<Result<GamePlayerActionRow, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = new Date()
      const gamePlayerActions = await this.db
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

      return toGamePlayerActionRow(gamePlayerActions[0])
    })

    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not upsert game player action", { ...params, error: upsertResult.error })
      return Result.Failure(couldNot("upsert game player action"))
    }

    return upsertResult
  }

  public async getByGameIdPlayerIdAndTick(params: {
    gameId: number
    playerId: number
    tick: number
  }): Promise<Result<GamePlayerActionRow | undefined, string>> {
    const getResult = await Result.tryCatch(
      async () =>
        await this.db
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
    const gamePlayerAction = getResult.value[0]
    return Result.Success(gamePlayerAction === undefined ? undefined : toGamePlayerActionRow(gamePlayerAction))
  }

  public async getByGameIdAndTick(params: { gameId: number; tick: number }): Promise<Result<GamePlayerActionRow[], string>> {
    const getResult = await Result.tryCatch(
      async () =>
        await this.db
          .select()
          .from(gamePlayerActionsTable)
          .where(and(eq(gamePlayerActionsTable.gameId, params.gameId), eq(gamePlayerActionsTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player actions by tick", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player actions by tick"))
    }

    return Result.Success(getResult.value.map(toGamePlayerActionRow))
  }

  public async deleteByGameIdPlayerIdAndTick(params: {
    gameId: number
    playerId: number
    tick: number
  }): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(async (): Promise<true> => {
      await this.db
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
