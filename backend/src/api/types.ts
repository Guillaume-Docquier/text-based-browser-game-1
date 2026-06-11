/**
 * Exports API types for the frontend
 */

import type { inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "#api/games/GameId.ts"
export type { PlayerId } from "#api/games/PlayerId.ts"
export type { AccountId } from "#api/accounts/AccountId.ts"

// Games router
type GamesLobbiesOutput = TrpcRouterOutput["games"]["getGameLobbies"]
export type GameLobby = GamesLobbiesOutput[number]
export type GameLobbyStatus = GameLobby["status"]
export type GameLobbyPlayer = GameLobby["creator"]

// Game player actions router
type GamePlayerActionsOutput = TrpcRouterOutput["gamePlayerActions"]["getCurrentAction"]
export type GamePlayerAction = NonNullable<GamePlayerActionsOutput["action"]>

// Star Systems router
type GetSystemOutput = TrpcRouterOutput["starSystems"]["getByGameId"]
export type StarSystem = GetSystemOutput["starSystem"]
export type Orbit = StarSystem["orbits"][number]
export type MovementEdges = StarSystem["movementEdges"]
export type MovementEdge = MovementEdges[string][number]
