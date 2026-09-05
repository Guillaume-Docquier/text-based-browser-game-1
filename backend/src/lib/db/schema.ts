import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { accountIdColumn } from "#lib/db/accounts/AccountId.ts"
import { actionIdColumn } from "#lib/db/actions/ActionId.ts"
import { gameIdColumn } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import { planetIdColumn } from "#lib/db/planets/PlanetId.ts"
import { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import { playerIdColumn } from "#lib/db/players/PlayerId.ts"
import { rulesetIdColumn } from "#lib/db/rulesets/RulesetId.ts"
import { starIdColumn } from "#lib/db/stars/StarId.ts"
import { TurnStatus } from "#lib/db/turns/TurnStatus.ts"
import type { ResolvedTargets } from "#lib/rules-engine/ruleset-model/actions/ResolvedTargets.ts"
import type { RulesetRulesJson } from "#lib/rulesets/rulesets.repository.ts"

/**
 * Turns a fake enum (const {} as const) into a pgEnum compatible parameter.
 * This is just type gymnastics
 */
function pgEnumify<TEnumLike extends string>(enumLike: Record<string, TEnumLike>): [TEnumLike, ...TEnumLike[]] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This is trusted code
  return Object.values(enumLike) as [TEnumLike, ...TEnumLike[]]
}

// pgEnums need to be exported for Postgres to create the enums
export const gameStatusEnum = pgEnum("game_status", pgEnumify(GameStatus))
export const turnStatusEnum = pgEnum("turn_status", pgEnumify(TurnStatus))
export const planetBiomeEnum = pgEnum("planet_biome", pgEnumify(PlanetBiome))
export const planetSizeEnum = pgEnum("planet_size", pgEnumify(PlanetSize))
export const playerColorEnum = pgEnum("player_color", pgEnumify(PlayerColor))

export const rulesetsTable = pgTable(
  "rulesets",
  {
    id: rulesetIdColumn("id").primaryKey(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull(),
    rules: jsonb("data").$type<RulesetRulesJson>().notNull(),
  },
  (table) => [
    uniqueIndex("rulesets_is_default_unique")
      .on(table.isDefault)
      .where(sql`${table.isDefault}`),
  ],
)

/**
 * User accounts.
 * Emails should be unique, but since this is handled by clerk, we didn't put a constraint here because I'm not sure if they allow it.
 */
export const accountsTable = pgTable(
  "accounts",
  {
    id: accountIdColumn("id").primaryKey().defaultRandom(),
    authId: text("auth_id").notNull(),
    email: text("email"),
    alias: text("alias"),
  },
  (table) => [uniqueIndex("auth_id_idx").on(table.authId)],
)

/**
 * All games, past and present.
 * This is only the game configuration and metadata. Turn state is stored in {@link turnsTable}.
 */
export const gamesTable = pgTable("games", {
  id: gameIdColumn("id").primaryKey().generatedAlwaysAsIdentity(),
  createdByAccountId: accountIdColumn("created_by_account_id")
    .notNull()
    .references(() => accountsTable.id, { onDelete: "cascade" }),
  winnerAccountId: accountIdColumn("winner_account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  status: gameStatusEnum("status").notNull().default(GameStatus.WAITING_FOR_PLAYERS),

  // Game configuration
  name: text("name").notNull(),
  nbSeats: integer("nb_seats").notNull(),
  turnIntervalSeconds: integer("turn_interval_seconds").notNull(),
  mapGenerationSeed: bigint("map_generation_seed", { mode: "number" }).notNull(),
  rulesetId: rulesetIdColumn("ruleset_id")
    .notNull()
    .references(() => rulesetsTable.id, { onDelete: "restrict" }),
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
    gameId: gameIdColumn("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    playerId: playerIdColumn("player_id")
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
    gameId: gameIdColumn("game_id").notNull(),
    playerId: playerIdColumn("player_id").notNull(),
    resourceType: text("resource_type").notNull(),
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
 * Actions available for a specific game turn.
 * Rows are kept as append-only history across turns.
 */
export const actionsTable = pgTable(
  "actions",
  {
    id: actionIdColumn("id").primaryKey().defaultRandom(),
    gameId: gameIdColumn("game_id").notNull(),
    playerId: playerIdColumn("player_id").notNull(),
    turn: integer("turn").notNull(),
    actionDefinitionId: text("action_definition_id").notNull(),
    /**
     * non-null when selected, empty object ({}) if the action is selected and has no targets at all
     */
    targets: jsonb("targets").$type<ResolvedTargets>(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.gameId, table.playerId],
      foreignColumns: [playersTable.gameId, playersTable.playerId],
      name: "actions_gameId_playerId_game_players_fk",
    }).onDelete("cascade"),
    index().on(table.gameId, table.playerId, table.turn),
  ],
)

/**
 * The state of turn computation
 */
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
    completedAt: timestamp("completed_at"),
    rngGeneratorState: bigint("rng_generator_state", { mode: "number" }).notNull(),
    rngSpareNormal: doublePrecision("rng_spare_normal"),
  },
  (table) => [
    primaryKey({
      columns: [table.gameId, table.turn],
    }),
    uniqueIndex("turns_one_open_turn_per_game_unique")
      .on(table.gameId)
      .where(sql`${table.status} <> 'COMPLETED'`),
    index("turns_status_ends_at_idx").on(table.status, table.endsAt),
  ],
)

/**
 * The processing queue for turns.
 */
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
    name: text("name").notNull(),
    coordinates: text("coordinates").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    biome: planetBiomeEnum("biome").notNull(),
    size: planetSizeEnum("size").notNull(),
    fertility: integer("fertility").notNull(),
    metal: integer("metal").notNull(),
    fuel: integer("fuel").notNull(),
    energy: integer("energy").notNull(),
    maxPopulation: integer("max_population").notNull(),
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
  ],
)
