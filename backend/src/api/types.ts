/**
 * Exports API types for the frontend
 */

import type { TrpcRouter } from "./createApi.ts"
import type { inferRouterOutputs } from "@trpc/server"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

// Games router
type GamesOutput = TrpcRouterOutput["games"]["getAll"]
export type GameSummary = GamesOutput["games"][number]
export type GameSummaryStatus = GameSummary["status"]
export type GameSummaryPlayer = GameSummary["creator"]
