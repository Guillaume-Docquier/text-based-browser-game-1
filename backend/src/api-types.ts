/**
 * Exports API types for the frontend
 */

import type { TrpcRouter } from "./createApp.ts"
import type { inferRouterOutputs } from "@trpc/server"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

// Games router
type GamesOutput = TrpcRouterOutput["games"]["getAll"]
export type Game = GamesOutput["games"][number]
