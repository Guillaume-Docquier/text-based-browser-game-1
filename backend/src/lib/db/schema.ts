import { sql } from "drizzle-orm"
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
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"

/**
 * Turns a fake enum (const {} as const) into a pgEnum compatible parameter.
 * This is just type gymnastics
 */
function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This is trusted code
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}

export const starSystemBodyTypeEnum = pgEnum("body_type", pgEnumify(BodyType))
export const gamePlayerActionTypeEnum = pgEnum("action_type", pgEnumify(GamePlayerActionType))
export const gameStatusEnum = pgEnum("game_status", pgEnumify(GameStatus))
export const playerColorEnum = pgEnum("player_color", pgEnumify(PlayerColor))

const accountId = uuid
const playerId = uuid
const gameId = integer

/**
 * User accounts.
 * Emails should be unique, but since this is handled by clerk, we didn't put a constraint here because I'm not sure if they allow it.
 */
export const accountsTable = pgTable(
  "accounts",
  {
    id: accountId("id").primaryKey().defaultRandom(),
    authId: varchar("auth_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    alias: varchar("alias", { length: 255 }),
  },
  (table) => [uniqueIndex("auth_id_idx").on(table.authId)],
)

/**
 * All games, past and present.
 * This is only the game configuration and metadata. Game state will exist in the {@link gameStatesTable}.
 */
export const gamesTable = pgTable("games", {
  id: gameId("id").primaryKey().generatedAlwaysAsIdentity(),
  createdByAccountId: accountId("created_by_account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  winnerAccountId: accountId("winner_account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  status: gameStatusEnum("status").notNull().default(GameStatus.WAITING_FOR_PLAYERS),

  // Game configuration

  name: varchar("name", { length: 255 }).notNull(),
  nbSeats: integer("nb_seats").notNull(),
  starSystemGenerationSettings: jsonb("star_system_generation_settings").$type<StarSystemGenerationSettings>().notNull(),
  tickIntervalSeconds: integer("tick_interval_seconds").notNull(),
})

/**
 * Join table between games and players.
 * AKA which players are in this game, and which games is this player in.
 *
 * For now, we don't have distinct player ids, we map it to the account id.
 * However in the future, we might want to have distinct playerIds if we want to do things like anonymous play or seat take over.
 */
export const playersTable = pgTable(
  "players",
  {
    gameId: gameId("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    playerId: playerId("player_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    color: playerColorEnum("color").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId],
    }),
    unique("players_game_id_color_unique").on(table.gameId, table.color),
  ],
)

/**
 * Resources owned by a player in a specific game.
 * One row per resource type.
 */
export const resourcesTable = pgTable(
  "resources",
  {
    gameId: gameId("game_id").notNull(),
    playerId: playerId("player_id").notNull(),
    resourceType: varchar("resource_type", { length: 255 }).notNull(),
    amount: integer("amount").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId, table.resourceType],
    }),
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [playersTable.gameId, playersTable.playerId],
      name: "resources_gameId_playerId_game_players_fk",
    }).onDelete("cascade"),
  ],
)

/**
 * The state of running games.
 */
export const gameStatesTable = pgTable("game_states", {
  gameId: gameId("game_id")
    .primaryKey()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  tick: integer("tick").notNull().default(0),
  nextTickAt: timestamp("next_tick_at").notNull(),
})

/**
 * Orders submitted for a specific game tick.
 * Rows are kept as append-only history across ticks.
 */
export const ordersTable = pgTable(
  "orders",
  {
    gameId: gameId("game_id").notNull(),
    playerId: playerId("player_id").notNull(),
    tick: integer("tick").notNull(),
    actionType: gamePlayerActionTypeEnum("action_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId, table.tick],
    }),
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [playersTable.gameId, playersTable.playerId],
      name: "orders_gameId_playerId_game_players_fk",
    }).onDelete("cascade"),
  ],
)

/**
 * The state of tick computation
 */
export const ticksTable = pgTable(
  "ticks",
  {
    gameId: gameId("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    tick: integer("tick").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    processingStartedAt: timestamp("processing_started_at"),
    processingEndedAt: timestamp("processing_ended_at"),
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
  gameId: gameId("game_id")
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
    id: uuid("id").notNull(),
    gameId: gameId("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    orbitNumber: integer("orbit_number").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.id] }),
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
    id: uuid("id").notNull(),
    gameId: gameId("game_id")
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
    primaryKey({ columns: [table.gameId, table.id] }),
    unique("sectors_game_id_orbit_id_sector_number_unique").on(table.gameId, table.orbitId, table.sectorNumber),
    unique("sectors_game_id_movement_node_id_unique").on(table.gameId, table.movementNodeId),
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
    id: uuid("id").notNull(),
    gameId: gameId("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
    sectorId: uuid("sector_id").notNull(),
    bodyNumber: integer("body_number").notNull(),
    bodyType: starSystemBodyTypeEnum("body_type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    movementNodeId: uuid("movement_node_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.id] }),
    unique("bodies_game_id_sector_id_body_number_unique").on(table.gameId, table.sectorId, table.bodyNumber),
    unique("bodies_game_id_movement_node_id_unique").on(table.gameId, table.movementNodeId),
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
    id: uuid("id").notNull(),
    gameId: gameId("game_id")
      .notNull()
      .references(() => starSystemsTable.gameId, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.id] }), index("movement_nodes_game_id_idx").on(table.gameId)],
)

/**
 * Directed movement graph edges. Undirected movement is stored as two directed rows.
 */
export const movementEdgesTable = pgTable(
  "movement_edges",
  {
    gameId: gameId("game_id")
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
