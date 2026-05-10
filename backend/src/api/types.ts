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

// World maps router
type WorldMapsGetSystemOutput = TrpcRouterOutput["worldMaps"]["getSystem"]
type WorldMapsGetSectorOutput = TrpcRouterOutput["worldMaps"]["getSector"]
type WorldMapsGetBodyOutput = TrpcRouterOutput["worldMaps"]["getBody"]
export type WorldMapSystem = WorldMapsGetSystemOutput["system"]
export type WorldMapOrbit = WorldMapSystem["orbits"][number]
export type WorldMapSector = WorldMapsGetSectorOutput["sector"]
export type WorldMapBody = WorldMapsGetBodyOutput["body"]
export type WorldMapMovementGraph = WorldMapSystem["movementGraph"]
export type WorldMapMovementEdge = WorldMapMovementGraph["edges"][string][number]
