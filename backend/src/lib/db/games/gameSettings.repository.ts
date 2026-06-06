import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gameSettingsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

type NewGameSettingsRow = typeof gameSettingsTable.$inferInsert
type GameSettingsRow = typeof gameSettingsTable.$inferSelect

export type NewGameSettingsModel = NewGameSettingsRow
export type GameSettingsModel = GameSettingsRow

export class GameSettingsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-settings-repository" })
  }

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

  public async update(
    { gameId }: { gameId: number },
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
