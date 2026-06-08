import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gameSettingsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { GameId } from "#api/games/GameId.ts"

type NewGameSettingsRow = typeof gameSettingsTable.$inferInsert
type GameSettingsRow = typeof gameSettingsTable.$inferSelect

export type NewGameSettingsModel = NewGameSettingsRow
export type GameSettingsModel = GameSettingsRow

/**
 * @deprecated To be replaced by better repositories
 */
export class GameSettingsRepository extends PostgresRepository {
  private readonly logger: Logger

  /**
   * @deprecated To be replaced by better repositories
   */
  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-settings-repository" })
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async create(
    newGameSettings: NewGameSettingsModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameSettingsModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gameSettings = await db.insert(gameSettingsTable).values(newGameSettings).returning()
      Assert.isTrue(gameSettings.length === 1)
      Assert.isDefined(gameSettings[0])

      return gameSettings[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game settings", { newGameSettings, error: createResult.error })
      return Result.Failure(couldNot("create game settings"))
    }

    return createResult
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async update(
    { gameId }: { gameId: GameId },
    gameSettings: Partial<GameSettingsModel>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(async (): Promise<true> => {
      await db.update(gameSettingsTable).set(gameSettings).where(eq(gameSettingsTable.gameId, gameId))

      return true
    })

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game settings", { gameId, gameSettings, error: updateResult.error })
      return Result.Failure(couldNot("update game settings"))
    }

    return updateResult
  }
}
