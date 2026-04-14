import { PostgresRepository } from "./PostgresRepository.ts"
import { gameStatesTable } from "./schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

export type GameStateRow = typeof gameStatesTable.$inferSelect
export type GameStateRowInsert = typeof gameStatesTable.$inferInsert

export class GameStatesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-states-repository" })
  }

  public async create(newGameState: GameStateRowInsert): Promise<Result<GameStateRow, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gameTicks = await this.db.insert(gameStatesTable).values(newGameState).returning()
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

  public async update({ gameId }: { gameId: number }, gameState: Partial<GameStateRowInsert>): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(async (): Promise<true> => {
      await this.db.update(gameStatesTable).set(gameState).where(eq(gameStatesTable.gameId, gameId))

      return true
    })

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game state", { gameId, gameState, error: updateResult.error })
      return Result.Failure(couldNot("update game state"))
    }

    return updateResult
  }

  public async getById({ gameId }: { gameId: number }): Promise<Result<GameStateRow | undefined, string>> {
    const gameStatesResult = await Result.tryCatch(
      async () => await this.db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId)),
    )

    if (Result.isFailure(gameStatesResult)) {
      this.logger.error("Could not get game state by id", { gameId, error: gameStatesResult.error })
      return Result.Failure(couldNot("get game state by id"))
    }

    Assert.isTrue(gameStatesResult.value.length <= 1)

    return Result.Success(gameStatesResult.value[0])
  }
}
