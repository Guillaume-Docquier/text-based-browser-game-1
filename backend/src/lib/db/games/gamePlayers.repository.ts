import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamePlayersTable } from "#lib/db/schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"

type NewGamePlayerRow = typeof gamePlayersTable.$inferInsert
type GamePlayerRow = typeof gamePlayersTable.$inferSelect

export type NewGamePlayerModel = NewGamePlayerRow
export type GamePlayerModel = GamePlayerRow

export class GamePlayersRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-accounts-repository" })
  }

  public async createPlayer(
    newGamePlayer: NewGamePlayerModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gamePlayers = await db.insert(gamePlayersTable).values(newGamePlayer).returning()
      Assert.isTrue(gamePlayers.length === 1)
      Assert.isDefined(gamePlayers[0])

      return gamePlayers[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game player", { newGamePlayer, error: createResult.error })
      return Result.Failure(couldNot("create game player"))
    }

    return createResult
  }

  public async delete(
    { gameId, playerId }: { gameId: number; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(async (): Promise<true> => {
      await db.delete(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.playerId, playerId)))

      return true
    })

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player", { gameId, playerId, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player"))
    }

    return deleteResult
  }

  public async getPlayerIds({ gameId }: { gameId: number }, db: PostgresRepository["db"] = this.db): Promise<Result<PlayerId[], string>> {
    const gamePlayersResult = await Result.tryCatch(
      db.select({ playerId: gamePlayersTable.playerId }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId)),
    )

    if (Result.isFailure(gamePlayersResult)) {
      this.logger.error("Could not get player ids", { gameId, error: gamePlayersResult.error })
      return Result.Failure(couldNot("get player ids"))
    }

    return Result.Success(gamePlayersResult.value.map(({ playerId }) => playerId))
  }

  public async hasPlayerJoinedGame(
    { gameId, playerId }: { gameId: number; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const joinedGameResult = await Result.tryCatch(async () => {
      const rows = await db
        .select({ playerId: gamePlayersTable.playerId })
        .from(gamePlayersTable)
        .where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.playerId, playerId)))
      Assert.isTrue(rows.length <= 1)

      return rows.length === 1
    })

    if (Result.isFailure(joinedGameResult)) {
      this.logger.error("Could not check if player joined game", { gameId, playerId, error: joinedGameResult.error })
      return Result.Failure(couldNot("check if player joined game"))
    }

    return joinedGameResult
  }
}
