import { PostgresRepository } from "#db/PostgresRepository.ts"
import { gamePlayersTable, gamesTable, playersTable } from "#db/schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { alias } from "drizzle-orm/pg-core"

export type GameRow = typeof gamesTable.$inferSelect
export type GameRowInsert = typeof gamesTable.$inferInsert

export type GameSummaryPlayerRow = Pick<typeof playersTable.$inferSelect, "id" | "alias">

export type GameSummaryRow = Omit<GameRow, "createdByPlayerId"> & {
  creator: GameSummaryPlayerRow
  players: GameSummaryPlayerRow[]
}

const pgCreatorAlias = alias(playersTable, "creator")
const pgPlayerAlias = alias(playersTable, "player")

export class GamesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "games-repository" })
  }

  public async create(newGame: GameRowInsert): Promise<GameRow> {
    const games = await this.db.insert(gamesTable).values(newGame).returning()
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    return games[0]
  }

  public async getSummaries(): Promise<GameSummaryRow[]> {
    const gameSummaries = await this.db
      .select({
        // game info
        id: gamesTable.id,
        name: gamesTable.name,
        maxPlayerCount: gamesTable.maxPlayerCount,
        createdAt: gamesTable.createdAt,
        startedAt: gamesTable.startedAt,
        endedAt: gamesTable.endedAt,

        // player info
        creatorId: pgCreatorAlias.id,
        creatorAlias: pgCreatorAlias.alias,

        playerId: pgPlayerAlias.id,
        playerAlias: pgPlayerAlias.alias,
      })
      .from(gamesTable)
      .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByPlayerId))
      .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
      .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId))

    // That is ugly af
    // Might need to learn proper sql here
    const dedupedGameIds = new Set()
    return gameSummaries
      .filter((gameSummary) => {
        if (!dedupedGameIds.has(gameSummary.id)) {
          dedupedGameIds.add(gameSummary.id)
          return true
        }

        return false
      })
      .map((gameSummary) => {
        const { creatorId, creatorAlias, playerId: _playerId, playerAlias: _playerAlias, ...gameInfo } = gameSummary

        return {
          ...gameInfo,
          creator: {
            id: creatorId,
            alias: creatorAlias,
          },
          players: gameSummaries
            .filter((row) => row.id === gameSummary.id && row.playerId !== null)
            .map((row) => ({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The filter above should have narrowed this type?
              id: row.playerId!,
              alias: row.playerAlias,
            })),
        }
      })
  }

  public async getSummaryById(options: { gameId: number }): Promise<GameSummaryRow | undefined> {
    return await this.getSummaryByIdInternal(options, this.db)
  }

  private async getSummaryByIdInternal(
    { gameId }: { gameId: number },
    dbOrTx: PostgresRepository["db"],
  ): Promise<GameSummaryRow | undefined> {
    const gameSummaries = await dbOrTx
      .select({
        // game info
        id: gamesTable.id,
        name: gamesTable.name,
        maxPlayerCount: gamesTable.maxPlayerCount,
        createdAt: gamesTable.createdAt,
        startedAt: gamesTable.startedAt,
        endedAt: gamesTable.endedAt,

        // player info
        creatorId: pgCreatorAlias.id,
        creatorAlias: pgCreatorAlias.alias,

        playerId: pgPlayerAlias.id,
        playerAlias: pgPlayerAlias.alias,
      })
      .from(gamesTable)
      .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByPlayerId))
      .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
      .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId))
      .where(eq(gamesTable.id, gameId))

    const gameSummary = gameSummaries[0]
    if (gameSummary === undefined) {
      return undefined
    }

    const { creatorId, creatorAlias, playerId: _playerId, playerAlias: _playerAlias, ...gameInfo } = gameSummary

    return {
      ...gameInfo,
      creator: {
        id: creatorId,
        alias: creatorAlias,
      },
      players: gameSummaries
        .filter((row) => row.playerId !== null)
        .map((row) => ({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The filter above should have narrowed this type?
          id: row.playerId!,
          alias: row.playerAlias,
        })),
    }
  }

  /**
   * Joins a game if `canJoin` allows it.
   */
  public async join({
    gameId,
    playerId,
    canJoin,
  }: {
    gameId: number
    playerId: number
    canJoin: (gameSummaryRow: GameSummaryRow) => boolean
  }): Promise<Result<true, string>> {
    return await this.db.transaction(async (tx) => {
      const gameSummaryRow = await this.getSummaryByIdInternal({ gameId }, tx)
      if (gameSummaryRow === undefined) {
        return Result.Failure(`Game with id ${gameId} does not exist. Cannot join.`)
      }

      if (!canJoin(gameSummaryRow)) {
        return Result.Failure(`Game with id ${gameId} is not joinable.`)
      }

      const joinGameResult = await Result.tryCatch(async () => await this.db.insert(gamePlayersTable).values({ gameId, playerId }))
      if (Result.isFailure(joinGameResult)) {
        this.logger.error("Could not insert row into the gamePlayersTable after all safety checks.", {
          gameId,
          playerId,
          error: joinGameResult.error,
        })
        return Result.Failure(`Cannot join game with id ${gameId}. See logs for more details.`)
      }

      return Result.Success(true)
    })
  }

  /**
   * Leaves a game if `canLeave` allows it.
   * If the player is not in the game, a Success will be returned.
   */
  public async leave({
    gameId,
    playerId,
    canLeave,
  }: {
    gameId: number
    playerId: number
    canLeave: (gameSummaryRow: GameSummaryRow) => boolean
  }): Promise<Result<true, string>> {
    return await this.db.transaction(async (tx) => {
      const gameSummaryRow = await this.getSummaryByIdInternal({ gameId }, tx)
      if (gameSummaryRow === undefined) {
        return Result.Failure(`Game with id ${gameId} does not exist. Cannot leave.`)
      }

      if (!canLeave(gameSummaryRow)) {
        return Result.Failure(`Game with id ${gameId} is not leavable.`)
      }

      const leaveGameResult = await Result.tryCatch(
        async () =>
          await this.db.delete(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.playerId, playerId))),
      )
      if (Result.isFailure(leaveGameResult)) {
        this.logger.error("Could not delete row from the gamePlayersTable after all safety checks.", {
          gameId,
          playerId,
          error: leaveGameResult.error,
        })
        return Result.Failure(`Cannot leave game with id ${gameId}. See logs for more details.`)
      }

      return Result.Success(true)
    })
  }
}
