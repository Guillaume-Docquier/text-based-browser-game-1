import {
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
  varchar,
} from "drizzle-orm/pg-core"

export const BodyType = {
  PLANET: "PLANET",
  MOON: "MOON",
  ASTEROID: "ASTEROID",
} as const

export type BodyType = (typeof BodyType)[keyof typeof BodyType]

export const gameMapBodyTypeEnum = pgEnum("game_map_body_type", [BodyType.PLANET, BodyType.MOON, BodyType.ASTEROID])

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
 * Static world map data for a game.
 */
export const gameMapsTable = pgTable("game_maps", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => gamesTable.id, { onDelete: "cascade" }),
  generationSettings: jsonb("generation_settings").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/**
 * Movement graph nodes for all concrete movement targets in a map.
 */
export const gameMapMovementNodesTable = pgTable(
  "game_map_movement_nodes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gameMapsTable.gameId, { onDelete: "cascade" }),
  },
  (table) => [
    unique("game_map_movement_nodes_game_id_id_unique").on(table.gameId, table.id),
    index("game_map_movement_nodes_game_id_idx").on(table.gameId),
  ],
)

/**
 * Star system orbits. Orbit numbers are the first coordinate segment.
 */
export const gameMapOrbitsTable = pgTable(
  "game_map_orbits",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gameMapsTable.gameId, { onDelete: "cascade" }),
    orbitNumber: integer("orbit_number").notNull(),
  },
  (table) => [
    unique("game_map_orbits_game_id_id_unique").on(table.gameId, table.id),
    unique("game_map_orbits_game_id_orbit_number_unique").on(table.gameId, table.orbitNumber),
    index("game_map_orbits_game_id_idx").on(table.gameId),
  ],
)

/**
 * Sectors inside orbits. Sectors are movement targets.
 */
export const gameMapSectorsTable = pgTable(
  "game_map_sectors",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gameMapsTable.gameId, { onDelete: "cascade" }),
    orbitId: integer("orbit_id").notNull(),
    sectorNumber: integer("sector_number").notNull(),
    movementNodeId: integer("movement_node_id").notNull(),
  },
  (table) => [
    unique("game_map_sectors_game_id_id_unique").on(table.gameId, table.id),
    unique("game_map_sectors_orbit_id_sector_number_unique").on(table.orbitId, table.sectorNumber),
    unique("game_map_sectors_movement_node_id_unique").on(table.movementNodeId),
    foreignKey({
      columns: [table.gameId, table.orbitId],
      foreignColumns: [gameMapOrbitsTable.gameId, gameMapOrbitsTable.id],
      name: "game_map_sectors_game_id_orbit_id_game_map_orbits_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.movementNodeId],
      foreignColumns: [gameMapMovementNodesTable.gameId, gameMapMovementNodesTable.id],
      name: "game_map_sectors_game_id_movement_node_id_game_map_movement_nodes_fk",
    }).onDelete("no action"),
    index("game_map_sectors_game_id_orbit_id_idx").on(table.gameId, table.orbitId),
  ],
)

/**
 * Bodies inside sectors. Bodies are movement targets.
 */
export const gameMapBodiesTable = pgTable(
  "game_map_bodies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => gameMapsTable.gameId, { onDelete: "cascade" }),
    sectorId: integer("sector_id").notNull(),
    bodyNumber: integer("body_number").notNull(),
    bodyType: gameMapBodyTypeEnum("body_type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    movementNodeId: integer("movement_node_id").notNull(),
  },
  (table) => [
    unique("game_map_bodies_game_id_id_unique").on(table.gameId, table.id),
    unique("game_map_bodies_sector_id_body_number_unique").on(table.sectorId, table.bodyNumber),
    unique("game_map_bodies_movement_node_id_unique").on(table.movementNodeId),
    foreignKey({
      columns: [table.gameId, table.sectorId],
      foreignColumns: [gameMapSectorsTable.gameId, gameMapSectorsTable.id],
      name: "game_map_bodies_game_id_sector_id_game_map_sectors_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.movementNodeId],
      foreignColumns: [gameMapMovementNodesTable.gameId, gameMapMovementNodesTable.id],
      name: "game_map_bodies_game_id_movement_node_id_game_map_movement_nodes_fk",
    }).onDelete("no action"),
    index("game_map_bodies_game_id_sector_id_idx").on(table.gameId, table.sectorId),
  ],
)

/**
 * Directed movement graph edges. Undirected movement is stored as two directed rows.
 */
export const gameMapMovementEdgesTable = pgTable(
  "game_map_movement_edges",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => gameMapsTable.gameId, { onDelete: "cascade" }),
    fromNodeId: integer("from_node_id").notNull(),
    toNodeId: integer("to_node_id").notNull(),
    weight: integer("weight").notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.fromNodeId, table.toNodeId],
    }),
    foreignKey({
      columns: [table.gameId, table.fromNodeId],
      foreignColumns: [gameMapMovementNodesTable.gameId, gameMapMovementNodesTable.id],
      name: "game_map_movement_edges_game_id_from_node_id_game_map_movement_nodes_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.toNodeId],
      foreignColumns: [gameMapMovementNodesTable.gameId, gameMapMovementNodesTable.id],
      name: "game_map_movement_edges_game_id_to_node_id_game_map_movement_nodes_fk",
    }).onDelete("cascade"),
    index("game_map_movement_edges_game_id_from_node_id_idx").on(table.gameId, table.fromNodeId),
  ],
)
