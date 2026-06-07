import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { playersTable } from "#lib/db/schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

type NewPlayerRow = typeof playersTable.$inferInsert
type PlayerRow = typeof playersTable.$inferSelect

export type NewPlayerModel = NewPlayerRow
export type PlayerModel = PlayerRow

export class PlayersRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "players-repository" })
  }

  public async create(newPlayer: NewPlayerModel, db: PostgresRepository["db"] = this.db): Promise<Result<PlayerModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const players = await db.insert(playersTable).values(newPlayer).returning()
      Assert.isTrue(players.length === 1)
      Assert.isDefined(players[0])

      return players[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create player", { newPlayer, error: createResult.error })
      return Result.Failure(couldNot("create player"))
    }

    return createResult
  }

  public async delete(
    { gameId, playerId }: { gameId: number; playerId: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(async (): Promise<true> => {
      await db.delete(playersTable).where(and(eq(playersTable.gameId, gameId), eq(playersTable.id, playerId)))

      return true
    })

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete player", { gameId, playerId, error: deleteResult.error })
      return Result.Failure(couldNot("delete player"))
    }

    return deleteResult
  }

  public async getPlayerIds({ gameId }: { gameId: number }, db: PostgresRepository["db"] = this.db): Promise<Result<string[], string>> {
    const playersResult = await Result.tryCatch(
      db.select({ playerId: playersTable.id }).from(playersTable).where(eq(playersTable.gameId, gameId)),
    )

    if (Result.isFailure(playersResult)) {
      this.logger.error("Could not get player ids", { gameId, error: playersResult.error })
      return Result.Failure(couldNot("get player ids"))
    }

    return Result.Success(playersResult.value.map(({ playerId }) => playerId))
  }

  public async getByGameIdAndAccountId(
    { gameId, accountId }: { gameId: number; accountId: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerModel | undefined, string>> {
    const getResult = await Result.tryCatch(async () => {
      const rows = await db
        .select()
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.accountId, accountId)))
      Assert.isTrue(rows.length <= 1)

      return rows[0]
    })

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get player by game and account", { gameId, accountId, error: getResult.error })
      return Result.Failure(couldNot("get player by game and account"))
    }

    return getResult
  }
}
