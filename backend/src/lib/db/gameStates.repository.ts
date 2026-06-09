import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { GameId } from "#api/games/GameId.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"
import { couldNot } from "#lib/errors.ts"
import { ResourceType } from "#lib/gameResources.ts"
import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerResourcesTable, gameStatesTable } from "./schema.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type GameStateRow = typeof gameStatesTable.$inferSelect

export type NewGameStateModel = NewGameStateRow
export type GameStateModel = GameStateRow
export type PlayerGameStateModel = GameStateModel & {
  playerId: PlayerId
  resources: {
    money: number
  }
}

/**
 * @deprecated To be replaced by better repositories
 */
export class GameStatesRepository extends PostgresRepository {
  private readonly logger: Logger

  /**
   * @deprecated To be replaced by better repositories
   */
  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-states-repository" })
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async create(newGameState: NewGameStateModel, db: PostgresRepository["db"] = this.db): Promise<Result<GameStateModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gameTicks = await db.insert(gameStatesTable).values(newGameState).returning()
      Assert.isTrue(gameTicks.length === 1)
      Assert.isDefined(gameTicks[0])

      return gameTicks[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game state", { newGameState, error: createResult.error })
      return Result.Failure(couldNot("create game state"))
    }

    return createResult
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async update(
    { gameId }: { gameId: GameId },
    gameState: Partial<NewGameStateModel>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(async (): Promise<true> => {
      await db.update(gameStatesTable).set(gameState).where(eq(gameStatesTable.gameId, gameId))

      return true
    })

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game state", { gameId, gameState, error: updateResult.error })
      return Result.Failure(couldNot("update game state"))
    }

    return updateResult
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async getById(
    { gameId }: { gameId: GameId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameStateModel | undefined, string>> {
    const gameStatesResult = await Result.tryCatch(db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId)))

    if (Result.isFailure(gameStatesResult)) {
      this.logger.error("Could not get game state by id", { gameId, error: gameStatesResult.error })
      return Result.Failure(couldNot("get game state by id"))
    }

    Assert.isTrue(gameStatesResult.value.length <= 1)

    return Result.Success(gameStatesResult.value[0])
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async getByGameIdAndPlayerId(
    {
      gameId,
      playerId,
    }: {
      gameId: GameId
      playerId: PlayerId
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerGameStateModel | undefined, string>> {
    const playerGameStateResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const gameStates = await tx.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId))
        Assert.isTrue(gameStates.length === 1)

        const gameState = gameStates[0]
        if (gameState === undefined) {
          return undefined
        }

        const playerResources = await tx
          .select()
          .from(gamePlayerResourcesTable)
          .where(and(eq(gamePlayerResourcesTable.gameId, gameId), eq(gamePlayerResourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money)

        return {
          ...gameState,
          playerId,
          resources: {
            // Long term this should be generic
            money: money.amount,
          },
        }
      }),
    )

    if (Result.isFailure(playerGameStateResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerGameStateResult.error })
      return Result.Failure(couldNot("get player game state by ids"))
    }

    return playerGameStateResult
  }
}
