/**
 * Exports API types for the frontend
 */

import type { inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "#lib/db/games/GameId.ts"
export type { PlayerId } from "#lib/db/players/PlayerId.ts"
export type { AccountId } from "#lib/db/accounts/AccountId.ts"
export type { PlayerColor } from "#lib/db/players/PlayerColor.ts"
export type { RulesetId } from "#lib/db/rulesets/RulesetId.ts"

// Lobbies
export type Lobby = TrpcRouterOutput["lobbies"]["getById"]
export type LobbyStatus = Lobby["status"]
export type LobbyPlayer = Lobby["creator"]
export type LobbyCreationSettings = TrpcRouterOutput["lobbies"]["getCreationSettings"]
export type RulesetSummary = LobbyCreationSettings["rulesets"][number]

// Listings
export type Listing = TrpcRouterOutput["listings"]["getListings"][number]

// Gameplay router
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
export type Action = PlayerView["actions"][number]
export type ResourceType = keyof PlayerView["resources"]
export type Ruleset = PlayerView["ruleset"]
export type ActionDefinition = Ruleset["actionDefinitions"][string]
export type ActionTier = ActionDefinition["tier"]
export type Mechanic = ActionDefinition["costs"][number] | ActionDefinition["mechanics"][number]
export type Actions = PlayerView["actions"][number]
export type Galaxy = PlayerView["galaxy"]
export type StarSystem = Galaxy["systems"][number]
export type Planet = StarSystem["planets"][number]
export type PlanetBiome = Planet["biome"]
export type PlanetSize = Planet["size"]
