/**
 * Exports API types for the frontend
 */

import type { inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "#api/shared/GameId.ts"
export type { PlayerId } from "#api/shared/PlayerId.ts"
export type { AccountId } from "#api/accounts/AccountId.ts"

// Lobbies
export type Lobby = TrpcRouterOutput["lobbies"]["getById"]
export type LobbyStatus = Lobby["status"]
export type LobbyPlayer = Lobby["creator"]
export type LobbyCreationSettings = TrpcRouterOutput["lobbies"]["getCreationSettings"]
export type StarSystemGenerationSettings = LobbyCreationSettings["defaultStarSystemGenerationSettings"]
export type StarSystemGenerationSettingsLimits = LobbyCreationSettings["starSystemGenerationSettingsLimits"]
export type RangeSettingKey = Exclude<keyof StarSystemGenerationSettings, "seed">

// Listings
export type Listing = TrpcRouterOutput["listings"]["getListings"][number]

// Gameplay router
type GamePlayerActionsOutput = TrpcRouterOutput["gameplay"]["getCurrentAction"]
export type GamePlayerAction = NonNullable<GamePlayerActionsOutput["action"]>
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
