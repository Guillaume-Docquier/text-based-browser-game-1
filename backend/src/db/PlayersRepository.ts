import { PostgresRepository } from "#db/PostgresRepository.ts"
import { playersTable } from "#db/schema.ts"
import { eq } from "drizzle-orm"
import type { NullToUndefined } from "../utilityTypes.ts"

export type Player = typeof playersTable.$inferSelect
type PlayerInsert = NullToUndefined<Omit<Player, "id">>

export class PlayersRepository extends PostgresRepository {
  public async findByAuthId({ authId }: { authId: string }): Promise<Player | undefined> {
    return (await this.db.select().from(playersTable).where(eq(playersTable.clerk_id, authId)))[0]
  }

  public async insert(player: PlayerInsert): Promise<Player | undefined> {
    return (
      await this.db
        .insert(playersTable)
        .values({
          clerk_id: player.clerk_id,
          email: player.email?.toLowerCase(),
        })
        .returning()
    )[0]
  }
}
