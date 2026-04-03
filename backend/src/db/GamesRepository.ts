import { PostgresRepository } from "#db/PostgresRepository.ts"
import { gamesTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"

export type GameRow = typeof gamesTable.$inferSelect

export class GamesRepository extends PostgresRepository {
  public async getAll(): Promise<GameRow[]> {
    return await this.db.select().from(gamesTable)
  }

  public async findById({ gameId }: { gameId: number }): Promise<GameRow | undefined> {
    return (await this.db.select().from(gamesTable).where(eq(gamesTable.id, gameId)))[0]
  }
}
