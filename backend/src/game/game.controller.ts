import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { gamesTable } from "../db/schema.ts"
import { eq, sql } from "drizzle-orm"

export class GameController {
  private readonly db
  private readonly gameId

  public constructor({ db, gameId }: { db: NodePgDatabase; gameId: number }) {
    this.db = db
    this.gameId = gameId
  }

  public async getTick(): Promise<number | undefined> {
    const [game] = await this.db.select({ tick: gamesTable.tick }).from(gamesTable).where(eq(gamesTable.id, this.gameId))

    return game?.tick
  }

  public async incrementTick({ by }: { by: number }): Promise<number | undefined> {
    const [game] = await this.db
      .update(gamesTable)
      .set({ tick: sql`${gamesTable.tick} + ${by}` })
      .where(eq(gamesTable.id, this.gameId))
      .returning()

    return game?.tick
  }
}
