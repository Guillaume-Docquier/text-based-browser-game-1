import { integer, pgTable, uniqueIndex, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core"

/**
 * All registered players.
 * One sign up is one player.
 */
export const playersTable = pgTable(
  "players",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clerk_id: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }),
  },
  (table) => [uniqueIndex("clerk_id_idx").on(table.clerk_id)],
)

/**
 * All games, past and present.
 * This is only the game settings. Game state will exist in another table?
 */
export const gamesTable = pgTable("games", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  createdByPlayerId: integer()
    .notNull()
    .references(() => playersTable.id, { onDelete: "cascade" }),
  maxPlayerCount: integer().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  startedAt: timestamp(),
  endedAt: timestamp(),
})

/**
 * Join table between games and players.
 * AKA which players are in this game, and which games is this player in.
 */
export const gamePlayersTable = pgTable(
  "game_players",
  {
    gameId: integer()
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    playerId: integer()
      .notNull()
      .references(() => playersTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId],
    }),
  ],
)
