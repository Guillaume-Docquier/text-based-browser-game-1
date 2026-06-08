import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamePlayersTable, gamesTable, gameSettingsTable, accountsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { alias } from "drizzle-orm/pg-core"
import { couldNot } from "#lib/errors.ts"
import type { GameSettingsModel } from "#lib/db/games/gameSettings.repository.ts"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/games/GameId.ts"

type NewGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect
type PlayerRow = typeof accountsTable.$inferSelect

export type NewGameModel = NewGameRow
export type GameModel = GameRow

export type GameSummaryModel = Omit<GameRow, "createdByAccountId"> & {
  settings: Omit<GameSettingsModel, "gameId">
  creator: GameSummaryPlayerModel
  players: GameSummaryPlayerModel[]
}
export type GameSummaryPlayerModel = Pick<PlayerRow, "id" | "alias">

const pgCreatorAlias = alias(accountsTable, "creator")
const pgPlayerAlias = alias(accountsTable, "player")

export class GamesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "games-repository" })
  }

  public async createGame(newGame: NewGameModel, db: PostgresRepository["db"] = this.db): Promise<Result<GameModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const games = await db.insert(gamesTable).values(newGame).returning()
      Assert.isTrue(games.length === 1)
      Assert.isDefined(games[0])

      return games[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game", { newGame, error: createResult.error })
      return Result.Failure(couldNot("create game"))
    }

    return createResult
  }

  public async updateGame(
    { gameId }: { gameId: GameId },
    game: Partial<NewGameModel>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(db.update(gamesTable).set(game).where(eq(gamesTable.id, gameId)))

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game", { gameId, game, error: updateResult.error })
      return Result.Failure(couldNot("update game"))
    }

    return Result.Success(true)
  }

  public async getGameSummaries(db: PostgresRepository["db"] = this.db): Promise<Result<GameSummaryModel[], string>> {
    const gameSummariesResult = await Result.tryCatch(
      db
        .select({
          // game info
          id: gamesTable.id,
          createdByAccountId: gamesTable.createdByAccountId,
          winnerAccountId: gamesTable.winnerAccountId,
          createdAt: gamesTable.createdAt,
          startedAt: gamesTable.startedAt,
          endedAt: gamesTable.endedAt,

          // settings
          name: gameSettingsTable.name,
          locked: gameSettingsTable.locked,
          starSystemGenerationSettings: gameSettingsTable.starSystemGenerationSettings,
          nbSeats: gameSettingsTable.nbSeats,
          tickIntervalSeconds: gameSettingsTable.tickIntervalSeconds,

          // player info
          creatorId: pgCreatorAlias.id,
          creatorAlias: pgCreatorAlias.alias,

          playerId: pgPlayerAlias.id,
          playerAlias: pgPlayerAlias.alias,
        })
        .from(gamesTable)
        .innerJoin(gameSettingsTable, eq(gameSettingsTable.gameId, gamesTable.id))
        .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByAccountId))
        .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
        .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId)),
    )

    if (Result.isFailure(gameSummariesResult)) {
      this.logger.error("Could not get game summaries", { error: gameSummariesResult.error })
      return Result.Failure(couldNot("get game summaries"))
    }

    const gameSummaries = gameSummariesResult.value

    // That is ugly af
    // Might need to learn proper sql here
    const dedupedGameIds = new Set()
    const dedupedGameSummaries = gameSummaries.filter((gameSummary) => {
      const isDuplicate = dedupedGameIds.has(gameSummary.id)
      dedupedGameIds.add(gameSummary.id)

      return !isDuplicate
    })

    return Result.Success(
      dedupedGameSummaries.map((gameSummary) => {
        const {
          creatorId,
          creatorAlias,
          playerId: _playerId,
          playerAlias: _playerAlias,
          createdByAccountId: _createdByAccountId,
          name,
          locked,
          starSystemGenerationSettings,
          nbSeats,
          tickIntervalSeconds,
          ...gameInfo
        } = gameSummary

        return {
          ...gameInfo,
          settings: {
            name,
            locked,
            starSystemGenerationSettings,
            nbSeats,
            tickIntervalSeconds,
          },
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
      }),
    )
  }

  public async getGameSummaryById(
    { gameId }: { gameId: GameId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameSummaryModel | undefined, string>> {
    const gameSummariesResult = await Result.tryCatch(
      db
        .select({
          // game info
          id: gamesTable.id,
          createdByAccountId: gamesTable.createdByAccountId,
          winnerAccountId: gamesTable.winnerAccountId,
          createdAt: gamesTable.createdAt,
          startedAt: gamesTable.startedAt,
          endedAt: gamesTable.endedAt,

          // settings
          name: gameSettingsTable.name,
          locked: gameSettingsTable.locked,
          starSystemGenerationSettings: gameSettingsTable.starSystemGenerationSettings,
          nbSeats: gameSettingsTable.nbSeats,
          tickIntervalSeconds: gameSettingsTable.tickIntervalSeconds,

          // player info
          creatorId: pgCreatorAlias.id,
          creatorAlias: pgCreatorAlias.alias,

          playerId: pgPlayerAlias.id,
          playerAlias: pgPlayerAlias.alias,
        })
        .from(gamesTable)
        .innerJoin(gameSettingsTable, eq(gameSettingsTable.gameId, gamesTable.id))
        .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByAccountId))
        .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
        .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId))
        .where(eq(gamesTable.id, gameId)),
    )

    if (Result.isFailure(gameSummariesResult)) {
      this.logger.error("Could not get game summary by id", { gameId, error: gameSummariesResult.error })
      return Result.Failure(couldNot("get game summary by id"))
    }

    const gameSummary = gameSummariesResult.value[0]
    if (gameSummary === undefined) {
      return Result.Success(undefined)
    }

    const {
      creatorId,
      creatorAlias,
      playerId: _playerId,
      playerAlias: _playerAlias,
      createdByAccountId: _createdByAccountId,
      name,
      locked,
      starSystemGenerationSettings,
      nbSeats,
      tickIntervalSeconds,
      ...gameInfo
    } = gameSummary

    return Result.Success({
      ...gameInfo,
      settings: {
        name,
        locked,
        starSystemGenerationSettings,
        nbSeats,
        tickIntervalSeconds,
      },
      creator: {
        id: creatorId,
        alias: creatorAlias,
      },
      players: gameSummariesResult.value
        .filter((row) => row.playerId !== null)
        .map((row) => ({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The filter above should have narrowed this type?
          id: row.playerId!,
          alias: row.playerAlias,
        })),
    })
  }

  public async endGameWithWinner(
    { gameId, winnerAccountId }: { gameId: GameId; winnerAccountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const endResult = await Result.tryCatch(async (): Promise<true> => {
      await db.update(gamesTable).set({ endedAt: new Date(), winnerAccountId }).where(eq(gamesTable.id, gameId))

      return true
    })

    if (Result.isFailure(endResult)) {
      this.logger.error("Could not end game with winner", { gameId, winnerAccountId, error: endResult.error })
      return Result.Failure(couldNot("end game with winner"))
    }

    return endResult
  }
}
