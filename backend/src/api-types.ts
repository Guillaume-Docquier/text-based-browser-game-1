/**
 * Exports API types for the frontend
 */

import type { AppRouter } from "./createApp.ts"
import type { inferRouterOutputs } from "@trpc/server"

type AppRouterOutput = inferRouterOutputs<AppRouter>

export type { AppRouter }

// Games router
type GamesOutput = AppRouterOutput["games"]["getAll"]
export type Game = GamesOutput["games"][number]
