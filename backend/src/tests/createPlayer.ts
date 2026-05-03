import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PlayerRow, PlayerRowInsert } from "#lib/db/players.repository.ts"
import { playersTable } from "#lib/db/schema.ts"
import { Assert } from "@guillaume-docquier/tools-ts"

/**
 * Inserts a player in the db and returns it.
 */
export async function createPlayer(db: NodePgDatabase, playerRowInsert: PlayerRowInsert): Promise<PlayerRow> {
  const player = (await db.insert(playersTable).values(playerRowInsert).returning())[0]
  Assert.isDefined(player)

  return player
}
