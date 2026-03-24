import { PostgresRepository } from "#db/PostgresRepository.ts"
import { gamesTable } from "#db/schema.ts"
import { eq, sql } from "drizzle-orm"

export type Game = typeof gamesTable.$inferSelect

export class GamesRepository extends PostgresRepository {
  public async getAll(): Promise<Game[]> {
    return await this.db.select().from(gamesTable)
  }

  public async findById({ gameId }: { gameId: number }): Promise<Game | undefined> {
    return (await this.db.select().from(gamesTable).where(eq(gamesTable.id, gameId)))[0]
  }

  public async incrementTick({ gameId, by }: { gameId: number; by: number }): Promise<Game | undefined> {
    return (
      await this.db
        .update(gamesTable)
        .set({ tick: sql`${gamesTable.tick} + ${by}` })
        .where(eq(gamesTable.id, gameId))
        .returning()
    )[0]
  }
}
