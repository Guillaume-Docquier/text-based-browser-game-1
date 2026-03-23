import { type gamesTable, type usersTable } from "./schema.ts"

export type Game = typeof gamesTable.$inferSelect
export type User = typeof usersTable.$inferSelect
