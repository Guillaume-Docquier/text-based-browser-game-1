/**
 * Exports API types for the frontend
 */

import type { TrpcRouter } from "./createApi.ts"
import type { inferRouterOutputs } from "@trpc/server"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

// Games router
type GamesOutput = TrpcRouterOutput["games"]["getSummaries"]
export type GameSummary = GamesOutput["games"][number]
export type GameSummaryStatus = GameSummary["status"]
export type GameSummaryPlayer = GameSummary["creator"]

// Game player actions router
type GamePlayerActionsOutput = TrpcRouterOutput["gamePlayerActions"]["getCurrentAction"]
export type GamePlayerAction = NonNullable<GamePlayerActionsOutput["action"]>

// Maps router
type GetMapOutput = TrpcRouterOutput["maps"]["getByGameId"]
export type Map = GetMapOutput["map"]
export type Orbit = Map["orbits"][number]
export type MovementEdges = Map["movementEdges"]
export type MovementEdge = MovementEdges[string][number]
