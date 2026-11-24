import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterInput = inferRouterInputs<TrpcRouter>
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

// oxlint-disable-next-line eslint-js/no-restricted-syntax -- The frontend tRPC client imports its router type through @api-types.
export type { TrpcRouter } from "./createApi.ts"

export type GameDetails = TrpcRouterOutput["games"]["getDetails"]
export type GameStatus = GameDetails["status"]
export type Player = GameDetails["creator"]

export type GameConfigurationDetails = GameDetails["configuration"]
export type GameListing = TrpcRouterOutput["games"]["getListings"][number]

export type TurnState = TrpcRouterOutput["gameplay"]["turnState"] extends AsyncIterable<infer TSnapshot> ? TSnapshot : never
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
export type Galaxy = PlayerView["galaxy"]
export type StarSystem = Galaxy["systems"][number]
export type Planet = StarSystem["planets"][number]
export type PlanetBiome = Planet["biome"]
export type PlanetSize = Planet["size"]

export type FinishOnboardingRequest = TrpcRouterInput["accounts"]["finishOnboarding"]
