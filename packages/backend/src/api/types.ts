/**
 * Exports API types for the frontend
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterInput = inferRouterInputs<TrpcRouter>
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "shared/domain/games/GameId.ts"
export type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
export type { PlayerId } from "shared/domain/players/PlayerId.ts"
export type { AccountId } from "shared/domain/accounts/AccountId.ts"
export type { PlayerColor } from "shared/domain/players/PlayerColor.ts"

// Games
export type GameDetails = TrpcRouterOutput["games"]["getDetails"]
export type GameStatus = GameDetails["status"]
export type Player = GameDetails["creator"]

export type GameConfigurationDetails = GameDetails["configuration"]
export type GameListing = TrpcRouterOutput["games"]["getListings"][number]

// Gameplay router
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
export type Galaxy = PlayerView["galaxy"]
export type StarSystem = Galaxy["systems"][number]
export type Planet = StarSystem["planets"][number]
export type PlanetBiome = Planet["biome"]
export type PlanetSize = Planet["size"]

// Account
export type FinishOnboardingRequest = TrpcRouterInput["accounts"]["finishOnboarding"]
