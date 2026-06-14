import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq, lte, isNull } from "drizzle-orm"
import type { GameStateModel } from "#api/gameplay/gameplay.repository.ts"
import type { GameId } from "#api/shared/GameId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, gameStatesTable, ticksTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type NewGameTickRow = typeof ticksTable.$inferInsert
type GameTickRow = typeof ticksTable.$inferSelect
type GameRow = typeof gamesTable.$inferSelect

export type NewGameTickModel = NewGameTickRow
export type GameTickModel = GameTickRow

export type TickToProcessModel = {
  game: GameRow
  gameTick: GameTickModel
  gameState: GameStateModel
}

export class GameTicksRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "ticks-repository" })
  }

  public async create(newGameTick: NewGameTickModel, db: PostgresRepository["db"] = this.db): Promise<Result<GameTickModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gameTicks = await db.insert(ticksTable).values(newGameTick).returning()
      Assert.isTrue(gameTicks.length === 1)
      Assert.isDefined(gameTicks[0])

      return gameTicks[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game tick", { newGameTick, error: createResult.error })
      return Result.Failure(couldNot("create game tick"))
    }

    return createResult
  }

  public async getTicksToProcess(db: PostgresRepository["db"] = this.db): Promise<Result<TickToProcessModel[], string>> {
    const ticksToProcessResult = await Result.tryCatch(
      db
        .select({
          game: gamesTable,
          gameTick: ticksTable,
          gameState: gameStatesTable,
        })
        .from(ticksTable)
        .innerJoin(gameStatesTable, eq(gameStatesTable.gameId, ticksTable.gameId))
        .innerJoin(gamesTable, eq(gamesTable.id, ticksTable.gameId))
        .where(and(isNull(ticksTable.processingStartedAt), lte(ticksTable.scheduledFor, new Date()))),
    )

    if (Result.isFailure(ticksToProcessResult)) {
      this.logger.error("Could not get ticks to process", { error: ticksToProcessResult.error })
      return Result.Failure(couldNot("get ticks to process"))
    }

    return Result.Success(
      ticksToProcessResult.value.map((tickToProcess) => ({
        game: tickToProcess.game,
        gameTick: tickToProcess.gameTick,
        gameState: tickToProcess.gameState,
      })),
    )
  }

  public async startProcessingTick(
    { gameId, tick }: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const startProcessingTickResult = await Result.tryCatch(
      db
        .update(ticksTable)
        .set({ processingStartedAt: new Date() })
        .where(and(eq(ticksTable.gameId, gameId), eq(ticksTable.tick, tick))),
    )

    if (Result.isFailure(startProcessingTickResult)) {
      this.logger.error("Could not start processing game tick", { gameId, tick, error: startProcessingTickResult.error })
      return Result.Failure(couldNot("start processing game tick"))
    }

    return Result.Success(true)
  }

  public async finishProcessingTick(
    { gameId, tick }: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const finishProcessingTickResult = await Result.tryCatch(
      db
        .update(ticksTable)
        .set({ processingEndedAt: new Date() })
        .where(and(eq(ticksTable.gameId, gameId), eq(ticksTable.tick, tick))),
    )

    if (Result.isFailure(finishProcessingTickResult)) {
      this.logger.error("Could not finish processing game tick", { gameId, tick, error: finishProcessingTickResult.error })
      return Result.Failure(couldNot("finish processing game tick"))
    }

    return Result.Success(true)
  }
}
