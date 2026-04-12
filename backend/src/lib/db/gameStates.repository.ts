import { PostgresRepository } from "./PostgresRepository.ts"
import { gameStatesTable } from "./schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"

export type GameStateRow = typeof gameStatesTable.$inferSelect
export type GameStateRowInsert = typeof gameStatesTable.$inferInsert

export class GameStatesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-states-repository" })
  }

  public async create(newGameState: GameStateRowInsert): Promise<GameStateRow> {
    const gameTicks = await this.db.insert(gameStatesTable).values(newGameState).returning()
    Assert.isTrue(gameTicks.length === 1)
    Assert.isDefined(gameTicks[0])

    return gameTicks[0]
  }

  public async update({ gameId }: { gameId: number }, gameState: Partial<GameStateRowInsert>): Promise<void> {
    await this.db.update(gameStatesTable).set(gameState).where(eq(gameStatesTable.gameId, gameId))
  }

  public async getById({ gameId }: { gameId: number }): Promise<Result<GameStateRow | undefined, string>> {
    const gameStatesResult = await Result.tryCatch(
      async () => await this.db.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId)),
    )

    if (Result.isFailure(gameStatesResult)) {
      const errorMessage = "Error getting game state by id"
      this.logger.error(errorMessage, { gameId, error: gameStatesResult.error })
      return Result.Failure(errorMessage)
    }

    Assert.isTrue(gameStatesResult.value.length <= 1)

    return Result.Success(gameStatesResult.value[0])
  }
}
