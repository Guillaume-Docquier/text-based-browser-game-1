import { PostgresRepository } from "#db/PostgresRepository.ts"
import { playersTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert } from "@guillaume-docquier/tools-ts"

export type PlayerRow = typeof playersTable.$inferSelect
export type PlayerRowInsert = typeof playersTable.$inferInsert

export class PlayersRepository extends PostgresRepository {
  public async insert(newPlayer: PlayerRowInsert): Promise<PlayerRow | undefined> {
    const players = await this.db
      .insert(playersTable)
      .values({
        clerk_id: newPlayer.clerk_id,
        email: newPlayer.email?.toLowerCase(),
      })
      .returning()
    Assert.isTrue(players.length === 1)
    Assert.isDefined(players[0])

    return players[0]
  }

  public async findByAuthId({ authId }: { authId: string }): Promise<PlayerRow | undefined> {
    return (await this.db.select().from(playersTable).where(eq(playersTable.clerk_id, authId)))[0]
  }
}
