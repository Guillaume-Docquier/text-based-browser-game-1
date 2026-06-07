import {
  check,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import type { StarSystemGenerationSettings } from "#lib/star-systems/StarSystemGenerationSettings.ts"

/**
 * Turns a fake enum (const {} as const) into a pgEnum compatible parameter.
 * This is just type gymnastics
 */
function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}

export const starSystemBodyTypeEnum = pgEnum("body_type", pgEnumify(BodyType))

/**
 * All registered accounts.
 * One sign up is one account.
 */
export const accountsTable = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    authId: varchar("auth_id", { length: 255 }).notNull(),
    email: varchar({ length: 255 }),
    alias: varchar({ length: 255 }),
  },
  (table) => [uniqueIndex("accounts_auth_id_idx").on(table.authId)],
)

/**
 * All games, past and present.
 * This is only the game settings. Game state will exist in the {@link gameStatesTable}.
 */
export const gamesTable = pgTable(
  "games",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    createdByAccountId: uuid()
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    winnerPlayerId: uuid().references((): AnyPgColumn => playersTable.id, { onDelete: "set null" }),
    createdAt: timestamp().defaultNow().notNull(),
    startedAt: timestamp(),
    endedAt: timestamp(),
  },
  (table) => [unique("games_id_created_by_account_id_unique").on(table.id, table.createdByAccountId)],
)

/**
 * Settings chosen when a game is created.
 * These are owned by the game and may change until they are locked when the game starts.
 */
export const gameSettingsTable = pgTable("game_settings", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  locked: boolean().default(false).notNull(),
  name: varchar({ length: 255 }).notNull(),
  starSystemGenerationSettings: jsonb("star_system_generation_settings").$type<StarSystemGenerationSettings>().notNull(),
  nbSeats: integer().notNull(),
  tickIntervalSeconds: integer().notNull(),
})

/**
 * All players participating in games.
 * A player belongs to exactly one game and one account.
 */
export const playersTable = pgTable(
  "players",
  {
    id: uuid().defaultRandom().primaryKey(),
    gameId: integer()
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    accountId: uuid()
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    unique("players_game_id_id_unique").on(table.gameId, table.id),
    uniqueIndex("players_game_id_account_id_idx").on(table.gameId, table.accountId),
  ],
)

/**
 * Resources owned by a player in a specific game.
 * One row per resource type.
 */
export const gamePlayerResourcesTable = pgTable(
  "game_player_resources",
  {
    gameId: integer().notNull(),
    playerId: uuid().notNull(),
    resourceType: varchar({ length: 255 }).notNull(),
    amount: integer().notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId, table.resourceType],
    }),
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [playersTable.gameId, playersTable.id],
      name: "game_player_resources_gameId_playerId_players_fk",
    }).onDelete("cascade"),
  ],
)

/**
 * The state of running games.
 */
export const gameStatesTable = pgTable("game_states", {
  gameId: integer()
    .primaryKey()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  tick: integer().notNull().default(0),
  nextTickAt: timestamp().notNull(),
})

/**
 * Player actions selected for a specific game tick.
 * Rows are kept as append-only history across ticks.
 */
export const gamePlayerActionsTable = pgTable(
  "game_player_actions",
  {
    gameId: integer().notNull(),
    playerId: uuid().notNull(),
    tick: integer().notNull(),
    actionType: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId, table.tick],
    }),
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [playersTable.gameId, playersTable.id],
      name: "game_player_actions_gameId_playerId_players_fk",
    }).onDelete("cascade"),
  ],
)

/**
 * The state of tick computation
 */
export const gameTicksTable = pgTable(
  "game_ticks",
  {
    gameId: integer()
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    tick: integer().notNull(),
    scheduledFor: timestamp().notNull(),
    processingStartedAt: timestamp(),
    processingEndedAt: timestamp(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.tick],
    }),
    index().on(table.scheduledFor),
  ],
)

/**
 * Static Star System data for a game.
 */
export const starSystemsTable = pgTable("star_systems", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/**
 * Star System orbits. Orbit numbers are the first coordinate segment.
 */
export const orbitsTable = pgTable(
  "orbits",
  {
    id: uuid("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    orbitNumber: integer("orbit_number").notNull(),
  },
  (table) => [
    unique("orbits_game_id_id_unique").on(table.gameId, table.id),
    unique("orbits_game_id_orbit_number_unique").on(table.gameId, table.orbitNumber),
    index("orbits_game_id_idx").on(table.gameId),
  ],
)

/**
 * Sectors inside orbits. Sectors are movement targets.
 */
export const sectorsTable = pgTable(
  "sectors",
  {
    id: uuid("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    orbitId: uuid("orbit_id").notNull(),
    sectorNumber: integer("sector_number").notNull(),
    angleNumericType: varchar("angle_numeric_type", { length: 16 }).notNull(),
    angleMaxBoundType: varchar("angle_max_bound_type", { length: 16 }).notNull(),
    startAngleDegrees: doublePrecision("start_angle_degrees").notNull(),
    endAngleDegrees: doublePrecision("end_angle_degrees").notNull(),
    movementNodeId: uuid("movement_node_id").notNull(),
  },
  (table) => [
    unique("sectors_game_id_id_unique").on(table.gameId, table.id),
    unique("sectors_orbit_id_sector_number_unique").on(table.orbitId, table.sectorNumber),
    unique("sectors_movement_node_id_unique").on(table.movementNodeId),
    foreignKey({
      columns: [table.gameId, table.orbitId],
      foreignColumns: [orbitsTable.gameId, orbitsTable.id],
      name: "sectors_game_id_orbit_id_orbits_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.movementNodeId],
      foreignColumns: [movementNodesTable.gameId, movementNodesTable.id],
      name: "sectors_game_id_movement_node_id_movement_nodes_fk",
    }).onDelete("no action"),
    check("sectors_angle_numeric_type_check", sql`${table.angleNumericType} in ('float', 'integer')`),
    check("sectors_angle_max_bound_type_check", sql`${table.angleMaxBoundType} in ('inclusive', 'exclusive')`),
    check("sectors_start_angle_degrees_check", sql`${table.startAngleDegrees} >= 0`),
    check("sectors_end_angle_degrees_check", sql`${table.endAngleDegrees} <= 360`),
    check("sectors_angle_degrees_order_check", sql`${table.startAngleDegrees} < ${table.endAngleDegrees}`),
    index("sectors_game_id_orbit_id_idx").on(table.gameId, table.orbitId),
  ],
)

/**
 * Bodies inside sectors. Bodies are movement targets.
 */
export const bodiesTable = pgTable(
  "bodies",
  {
    id: uuid("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    sectorId: uuid("sector_id").notNull(),
    bodyNumber: integer("body_number").notNull(),
    bodyType: starSystemBodyTypeEnum("body_type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    movementNodeId: uuid("movement_node_id").notNull(),
  },
  (table) => [
    unique("bodies_game_id_id_unique").on(table.gameId, table.id),
    unique("bodies_sector_id_body_number_unique").on(table.sectorId, table.bodyNumber),
    unique("bodies_movement_node_id_unique").on(table.movementNodeId),
    foreignKey({
      columns: [table.gameId, table.sectorId],
      foreignColumns: [sectorsTable.gameId, sectorsTable.id],
      name: "bodies_game_id_sector_id_sectors_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.movementNodeId],
      foreignColumns: [movementNodesTable.gameId, movementNodesTable.id],
      name: "bodies_game_id_movement_node_id_movement_nodes_fk",
    }).onDelete("no action"),
    index("bodies_game_id_sector_id_idx").on(table.gameId, table.sectorId),
  ],
)

/**
 * Movement graph nodes for all concrete movement targets in a Star System.
 */
export const movementNodesTable = pgTable(
  "movement_nodes",
  {
    id: uuid("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
  },
  (table) => [unique("movement_nodes_game_id_id_unique").on(table.gameId, table.id), index("movement_nodes_game_id_idx").on(table.gameId)],
)

/**
 * Directed movement graph edges. Undirected movement is stored as two directed rows.
 */
export const movementEdgesTable = pgTable(
  "movement_edges",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    fromNodeId: uuid("from_node_id").notNull(),
    toNodeId: uuid("to_node_id").notNull(),
    weight: integer("weight").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.fromNodeId, table.toNodeId],
    }),
    foreignKey({
      columns: [table.gameId, table.fromNodeId],
      foreignColumns: [movementNodesTable.gameId, movementNodesTable.id],
      name: "movement_edges_game_id_from_node_id_movement_nodes_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.toNodeId],
      foreignColumns: [movementNodesTable.gameId, movementNodesTable.id],
      name: "movement_edges_game_id_to_node_id_movement_nodes_fk",
    }).onDelete("cascade"),
    index("movement_edges_game_id_from_node_id_idx").on(table.gameId, table.fromNodeId),
  ],
)
