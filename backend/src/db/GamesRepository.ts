import { PostgresRepository } from "#db/PostgresRepository.ts"
import { gamePlayersTable, gamesTable, playersTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert } from "@guillaume-docquier/tools-ts"
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
  public async create(newGame: GameRowInsert): Promise<GameRow> {
    const games = await this.db.insert(gamesTable).values(newGame).returning()
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    return games[0]
  }

  public async getAll(): Promise<GameSummaryRow[]> {
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

  public async findById({ gameId }: { gameId: number }): Promise<GameSummaryRow | undefined> {
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
}
