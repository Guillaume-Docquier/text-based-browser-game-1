import { PostgresRepository } from "#db/PostgresRepository.ts"
import { gamesTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert } from "@guillaume-docquier/tools-ts"

export type GameRow = typeof gamesTable.$inferSelect
export type GameRowInsert = typeof gamesTable.$inferInsert

export class GamesRepository extends PostgresRepository {
  public async create(newGame: GameRowInsert): Promise<GameRow> {
    const games = await this.db.insert(gamesTable).values(newGame).returning()
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    return games[0]
  }

  public async getAll(): Promise<GameRow[]> {
    return await this.db.select().from(gamesTable)
  }

  public async findById({ gameId }: { gameId: number }): Promise<GameRow | undefined> {
    return (await this.db.select().from(gamesTable).where(eq(gamesTable.id, gameId)))[0]
  }
}
