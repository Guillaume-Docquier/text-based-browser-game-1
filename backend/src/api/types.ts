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

// Listings
export type Listing = TrpcRouterOutput["listings"]["getListings"][number]

// Gameplay router
type GamePlayerActionsOutput = TrpcRouterOutput["gameplay"]["getCurrentAction"]
export type GamePlayerAction = NonNullable<GamePlayerActionsOutput["action"]>

// Star Systems router
type GetSystemOutput = TrpcRouterOutput["starSystems"]["getByGameId"]
export type StarSystem = GetSystemOutput["starSystem"]
export type Orbit = StarSystem["orbits"][number]
export type MovementEdges = StarSystem["movementEdges"]
export type MovementEdge = MovementEdges[string][number]
