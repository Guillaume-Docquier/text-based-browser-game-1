import {
  check,
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
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { BodyType } from "#lib/star-systems/BodyType.ts"

/**
 * Turns a fake enum (const {} as const) into a pgEnum compatible parameter.
 * This is just type gymnastics
 */
function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}

export const starSystemBodyTypeEnum = pgEnum("body_type", pgEnumify(BodyType))

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
    alias: varchar({ length: 255 }),
  },
  (table) => [uniqueIndex("clerk_id_idx").on(table.clerk_id)],
)

/**
 * All games, past and present.
 * This is only the game settings. Game state will exist in the {@link gameStatesTable}.
 */
export const gamesTable = pgTable("games", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  createdByPlayerId: integer()
    .notNull()
    .references(() => playersTable.id, { onDelete: "cascade" }),
  winnerPlayerId: integer().references(() => playersTable.id, { onDelete: "set null" }),
  nbSeats: integer().notNull(),
  tickIntervalSeconds: integer().notNull(),
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

/**
 * Resources owned by a player in a specific game.
 * One row per resource type.
 */
export const gamePlayerResourcesTable = pgTable(
  "game_player_resources",
  {
    gameId: integer().notNull(),
    playerId: integer().notNull(),
    resourceType: varchar({ length: 255 }).notNull(),
    amount: integer().notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId, table.resourceType],
    }),
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [gamePlayersTable.gameId, gamePlayersTable.playerId],
      name: "game_player_resources_gameId_playerId_game_players_fk",
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
    playerId: integer().notNull(),
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
      foreignColumns: [gamePlayersTable.gameId, gamePlayersTable.playerId],
      name: "game_player_actions_gameId_playerId_game_players_fk",
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
  generationSettings: jsonb("generation_settings").notNull(),
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
