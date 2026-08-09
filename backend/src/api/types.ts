/**
 * Exports API types for the frontend
 */

import type { inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "#api/shared/GameId.ts"
export type { PlayerId } from "#api/shared/PlayerId.ts"
export type { AccountId } from "#lib/db/accounts/AccountId.ts"
export type { PlayerColor } from "#lib/db/PlayerColor.ts"

// Lobbies
export type Lobby = TrpcRouterOutput["lobbies"]["getById"]
export type LobbyStatus = Lobby["status"]
export type LobbyPlayer = Lobby["creator"]
export type LobbyCreationSettings = TrpcRouterOutput["lobbies"]["getCreationSettings"]

// Listings
export type Listing = TrpcRouterOutput["listings"]["getListings"][number]

// Gameplay router
type CurrentActionOutput = TrpcRouterOutput["gameplay"]["getCurrentAction"]
export type ActionDto = NonNullable<CurrentActionOutput["action"]>
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
export type Galaxy = PlayerView["galaxy"]
export type StarSystem = Galaxy["systems"][number]
