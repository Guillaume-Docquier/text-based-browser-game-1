/**
 * Exports API types for the frontend
 */

import type { inferRouterOutputs } from "@trpc/server"
import type { ActionDefinitionId } from "game-rules/models/ActionDefinitionId.ts"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "game-rules/models/GameId.ts"
export type { PlanetId } from "game-rules/models/PlanetId.ts"
export type { PlayerId } from "game-rules/models/PlayerId.ts"
export type { AccountId } from "game-rules/models/AccountId.ts"
export type { PlayerColor } from "#lib/db/players/PlayerColor.ts"
export type { RulesetId } from "game-rules/models/RulesetId.ts"
export type { TargetTag } from "game-rules/ruleset/action-definitions/TargetTag.ts"

// Lobbies
export type Lobby = TrpcRouterOutput["lobbies"]["getById"]
export type LobbyStatus = Lobby["status"]
export type LobbyPlayer = Lobby["creator"]
export type LobbyPlayers = Lobby["players"]
export type LobbyCreationSettings = TrpcRouterOutput["lobbies"]["getCreationSettings"]
export type RulesetSummary = LobbyCreationSettings["rulesets"][number]

// Listings
export type Listing = TrpcRouterOutput["listings"]["getListings"][number]

// Gameplay router
export type PlayerView = TrpcRouterOutput["gameplay"]["getPlayerView"]
export type Action = PlayerView["actions"][number]
export type SelectedTargets = Action["selectedTargets"]
export type TargetId = NonNullable<SelectedTargets>[keyof NonNullable<SelectedTargets>]
export type ResourceType = keyof PlayerView["resources"]
export type Ruleset = PlayerView["ruleset"]
export type ActionDefinition = Ruleset["actionDefinitions"][ActionDefinitionId]
export type TargetDefinition = ActionDefinition["targets"][keyof ActionDefinition["targets"]]
export type TargetConstraints = TargetDefinition["constraints"]
export type TargetConstraint = TargetConstraints[number]
export type TargetConstraintType = TargetConstraint["type"]
export type ActionTier = ActionDefinition["tier"]
export type EffectDefinition = ActionDefinition["costs"][number] | ActionDefinition["effects"][number]
export type Actions = PlayerView["actions"][number]
export type Galaxy = PlayerView["galaxy"]
export type StarSystem = Galaxy["systems"][number]
export type Planet = StarSystem["planets"][number]
export type Fleet = PlayerView["fleets"][number]
export type PlanetBiome = Planet["biome"]
export type PlanetSize = Planet["size"]
