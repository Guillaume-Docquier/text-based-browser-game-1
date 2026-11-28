import { eq, ne, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { Alias } from "shared/domain/accounts/Alias.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { BuildingType, type BuildingId } from "shared/domain/world/buildings/Building.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { accountIdColumn } from "#lib/db/accounts/AccountId.ts"
import { gameIdColumn } from "#lib/db/games/GameId.ts"
import { planetIdColumn } from "#lib/db/planets/PlanetId.ts"
import { planetNameColumn } from "#lib/db/planets/PlanetName.ts"
import { playerIdColumn } from "#lib/db/players/PlayerId.ts"
import { starIdColumn } from "#lib/db/stars/StarId.ts"

function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This is trusted code
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}

export const gameStatusEnum = pgEnum("game_status", pgEnumify(GameStatus))
export const turnStatusEnum = pgEnum("turn_status", pgEnumify(TurnStatus))
export const buildingTypeEnum = pgEnum("building_type", pgEnumify(BuildingType))
export const planetBiomeEnum = pgEnum("planet_biome", pgEnumify(PlanetBiome))
export const planetSizeEnum = pgEnum("planet_size", pgEnumify(PlanetSize))
export const playerColorEnum = pgEnum("player_color", pgEnumify(PlayerColor))

export const accountsTable = pgTable(
  "accounts",
  {
    id: accountIdColumn("id").primaryKey().defaultRandom(),
    authId: text("auth_id").notNull(),
    email: text("email"),
    alias: text("alias").$type<Alias>().notNull(),
    onboarded: boolean("onboarded").notNull(),
  },
  (table) => [uniqueIndex("auth_id_idx").on(table.authId), uniqueIndex("accounts_alias_unique").on(sql`lower(${table.alias})`)],
)

export const gamesTable = pgTable("games", {
  id: gameIdColumn("id").primaryKey().generatedAlwaysAsIdentity(),
  createdByAccountId: accountIdColumn("created_by_account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  status: gameStatusEnum("status").notNull().default(GameStatus.WAITING_FOR_PLAYERS),

  name: text("name").notNull(),
  nbSeats: integer("nb_seats").notNull(),
  turnIntervalSeconds: integer("turn_interval_seconds").notNull(),
  mapGenerationSeed: bigint("map_generation_seed", { mode: "number" }).notNull(),
})

export const playersTable = pgTable(
  "players",
  {
    gameId: gameIdColumn("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    playerId: playerIdColumn("player_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    color: playerColorEnum("color").notNull(),
    isReady: boolean("is_ready").notNull().default(false),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.playerId],
    }),
    unique("players_game_id_color_unique").on(table.gameId, table.color),
  ],
)

export const turnsTable = pgTable(
  "turns",
  {
    gameId: gameIdColumn("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    turn: integer("turn").notNull(),
    status: turnStatusEnum("status").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    closedAt: timestamp("closed_at"),
    rngGeneratorState: bigint("rng_generator_state", { mode: "number" }).notNull(),
    rngSpareNormal: doublePrecision("rng_spare_normal"),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.turn],
    }),
    uniqueIndex("turns_one_open_turn_per_game_unique").on(table.gameId).where(ne(table.status, TurnStatus.COMPLETED).inlineParams()),
    index("turns_status_ends_at_idx").on(table.status, table.endsAt),
  ],
)

export const turnsProcessingTable = pgTable(
  "turns_processing",
  {
    gameId: gameIdColumn("game_id").notNull(),
    turn: integer("turn").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    processingStartedAt: timestamp("processing_started_at"),
    processingEndedAt: timestamp("processing_ended_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.turn],
    }),
    foreignKey({
      columns: [table.gameId, table.turn],
      foreignColumns: [turnsTable.gameId, turnsTable.turn],
      name: "turns_processing_game_id_turn_turns_fk",
    }).onDelete("cascade"),
    index("turns_processing_scheduled_for_idx").on(table.scheduledFor),
  ],
)

export const starsTable = pgTable(
  "stars",
  {
    gameId: gameIdColumn("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    id: starIdColumn("id").notNull(),
    name: text("name").notNull(),
    coordinates: text("coordinates").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.id],
    }),
  ],
)

export const planetsTable = pgTable(
  "planets",
  {
    gameId: gameIdColumn("game_id").notNull(),
    starId: starIdColumn("star_id").notNull(),
    id: planetIdColumn("id").notNull(),
    ownerPlayerId: playerIdColumn("owner_player_id"),
    name: planetNameColumn("name").notNull(),
    coordinates: text("coordinates").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    biome: planetBiomeEnum("biome").notNull(),
    size: planetSizeEnum("size").notNull(),
    metalProduction: integer("metal_production").notNull(),
    remainingMetalDeposit: integer("remaining_metal_deposit").notNull(),
    area: integer("area").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.id],
    }),
    foreignKey({
      columns: [table.gameId, table.starId],
      foreignColumns: [starsTable.gameId, starsTable.id],
      name: "planets_gameId_starId_planets_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.gameId, table.ownerPlayerId],
      foreignColumns: [playersTable.gameId, playersTable.playerId],
      name: "planets_gameId_ownerPlayerId_game_players_fk",
    }),
  ],
)

export const buildingsTable = pgTable(
  "buildings",
  {
    gameId: gameIdColumn("game_id").notNull(),
    id: uuid("id").$type<BuildingId>().defaultRandom().notNull(),
    type: buildingTypeEnum("type").notNull(),
    planetId: planetIdColumn("planet_id").notNull(),
    site: integer("site").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.id] }),
    foreignKey({ columns: [table.gameId, table.planetId], foreignColumns: [planetsTable.gameId, planetsTable.id] }).onDelete("cascade"),
    unique("buildings_one_per_site").on(table.gameId, table.planetId, table.site),
    uniqueIndex("buildings_one_command_center_per_planet")
      .on(table.gameId, table.planetId)
      .where(eq(table.type, BuildingType.COMMAND_CENTER).inlineParams()),
  ],
)
