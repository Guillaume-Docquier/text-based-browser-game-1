/**
 * Exports API types for the frontend
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { TrpcRouter } from "./createApi.ts"

type TrpcRouterInput = inferRouterInputs<TrpcRouter>
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>

export type { TrpcRouter }

export type { GameId } from "shared/domain/games/GameId.ts"
export type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
export type { PlayerId } from "shared/domain/players/PlayerId.ts"
export type { AccountId } from "shared/domain/accounts/AccountId.ts"
export type { PlayerColor } from "shared/domain/players/PlayerColor.ts"
export type { RulesetId } from "shared/domain/ruleset/RulesetId.ts"
export type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"

// Games
export type GameDetails = TrpcRouterOutput["games"]["getById"]
export type GameStatus = GameDetails["status"]
export type Player = GameDetails["creator"]
export type Players = GameDetails["players"]
export type GameCreationSettings = TrpcRouterOutput["games"]["getCreationSettings"]
export type RulesetSummary = GameCreationSettings["rulesets"][number]

export type GameConfigurationDetails = GameDetails["configuration"]
export type GameListing = TrpcRouterOutput["games"]["getListings"][number]

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

// Account
export type FinishOnboardingRequest = TrpcRouterInput["accounts"]["finishOnboarding"]
