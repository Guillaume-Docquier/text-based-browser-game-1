import { branded, Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { computeAvailableActions } from "shared/action-submission/computeAvailableActions.ts"
import {
  evaluateActionSelection,
  evaluateSubmittedActions,
  type EligibilityState,
} from "shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema, type PlayerId } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionIdSchema } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import type { Action, SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedInputsSchema } from "shared/domain/turns/actions/SelectedInputs.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { FleetMovementSchema } from "shared/domain/world/fleets/Fleet.ts"
import { FleetIdSchema } from "shared/domain/world/fleets/FleetId.ts"
import { FleetNameSchema } from "shared/domain/world/fleets/FleetName.ts"
import { PlanetBiome } from "shared/domain/world/planets/PlanetBiome.ts"
import { PlanetCoordinatesSchema } from "shared/domain/world/planets/PlanetCoordinates.ts"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { PlanetNameSchema } from "shared/domain/world/planets/PlanetName.ts"
import { PlanetSize } from "shared/domain/world/planets/PlanetSize.ts"
import { StarCoordinatesSchema } from "shared/domain/world/stars/StarCoordinates.ts"
import { StarIdSchema } from "shared/domain/world/stars/StarId.ts"
import { z } from "zod"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import type { GameplayRepository, PlayerViewModel } from "./gameplay.repository.ts"

/**
 * Reads a player's gameplay view, including resource commitments and Action affordability.
 */
export class GetPlayerViewUseCase {
  private readonly gameplayRepository: GameplayRepository

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  /**
   * Returns the player's view, or undefined when no view exists for the requested player.
   */
  public async execute({ gameId, playerId }: GetPlayerViewDto): Promise<Result<PlayerViewDto | undefined, string>> {
    const playerViewResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(playerViewResult)) {
      return playerViewResult
    }

    if (playerViewResult.value === undefined) {
      // This is not a Failure because everything went right.
      // It's a bad request, but not unexpected from here that no player view is found.
      return Result.Success(undefined)
    }

    return Result.Success(toPlayerViewDto(playerViewResult.value))
  }
}

function toPlayerViewDto(playerViewModel: PlayerViewModel): PlayerViewDto {
  const eligibilityState = createEligibilityState(playerViewModel)
  const submittedActions = eligibilityState.actions.filter(isSubmittedAction)
  const evaluation = evaluateSubmittedActions({ state: eligibilityState, ruleset: playerViewModel.ruleset, submissions: submittedActions })
  const actionAffordabilityState =
    playerViewModel.turnStatus === TurnStatus.COMPLETED
      ? {
          ...eligibilityState,
          actions: computeAvailableActions({ playerIds: [eligibilityState.submittingPlayerId], ruleset: playerViewModel.ruleset }),
        }
      : eligibilityState
  const uncommittedResources =
    playerViewModel.turnStatus === TurnStatus.COMPLETED
      ? playerViewModel.resources // When the turn is completed, at action costs have been spent already, so we don't need to compute commitments
      : Object.values(ResourceType).reduce<Resources>(
          (uncommitted, resourceType) => {
            uncommitted[resourceType] = Math.max(0, playerViewModel.resources[resourceType] - evaluation.resourceCommitments[resourceType])
            return uncommitted
          },
          {
            [ResourceType.INFLUENCE]: 0,
            [ResourceType.METAL]: 0,
            [ResourceType.FUEL]: 0,
            [ResourceType.ENERGY]: 0,
            [ResourceType.COLONY]: 0,
          },
        )

  return {
    gameId: playerViewModel.gameId,
    player: playerViewModel.player,
    opponents: playerViewModel.opponents,
    galaxy: {
      systems: playerViewModel.galaxy.systems.map(({ star, planets }) => ({
        star,
        planets: [...planets],
      })),
    },
    fleets: playerViewModel.fleets,
    turn: playerViewModel.turn,
    turnStatus: playerViewModel.turnStatus,
    turnEndsAt: playerViewModel.turnEndsAt,
    resources: toResourcesDto(playerViewModel.resources, uncommittedResources),
    ruleset: playerViewModel.ruleset,
    actions: toActionDtos(playerViewModel, actionAffordabilityState),
  }
}

function toResourcesDto(totalResources: Readonly<Resources>, uncommittedResources: Readonly<Resources>): PlayerViewDto["resources"] {
  return Object.values(ResourceType).reduce<Record<string, ResourceAmountsDto>>((resourcesDto, resourceType) => {
    const total = totalResources[resourceType]
    resourcesDto[resourceType] = {
      total,
      uncommitted: uncommittedResources[resourceType],
    }
    return resourcesDto
  }, {})
}

function toActionDtos(playerViewModel: PlayerViewModel, eligibilityState: EligibilityState): ActionDto[] {
  return playerViewModel.actions.map((action) => {
    const isInProgress = playerViewModel.fleets.some(
      (fleet) => fleet.ownerPlayerId === playerViewModel.player.id && fleet.movement?.submission.id === action.id,
    )
    const evaluation = evaluateActionSelection({
      state: eligibilityState,
      ruleset: playerViewModel.ruleset,
      draft: {
        actionId: action.id,
        selectedTargets: action.selectedTargets ?? {},
        selectedInputs: action.selectedInputs ?? {},
      },
    })

    return {
      ...action,
      canAfford: !isInProgress && !evaluation.issues.some(({ code }) => code === "INSUFFICIENT_RESOURCES"),
      isInProgress,
    }
  })
}

function createEligibilityState(playerViewModel: PlayerViewModel): EligibilityState {
  const playerId = playerViewModel.player.id
  const playerIds = [playerId, ...Object.keys(playerViewModel.opponents).map((id) => branded<PlayerId>(id))]
  const actions = computeAvailableActions({ playerIds: [playerId], ruleset: playerViewModel.ruleset }).map((availableAction) => {
    const persistedAction = playerViewModel.actions.find(({ id }) => id === availableAction.id)
    return persistedAction === undefined || persistedAction.selectedTargets === null || persistedAction.selectedInputs === null
      ? availableAction
      : {
          ...availableAction,
          selectedTargets: persistedAction.selectedTargets,
          selectedInputs: persistedAction.selectedInputs,
        }
  })
  const planets = playerViewModel.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)

  return {
    gameId: playerViewModel.gameId,
    turn: playerViewModel.turn,
    submittingPlayerId: playerId,
    resources: playerViewModel.resources,
    players: Object.fromEntries(playerIds.map((id) => [id, { id, ownerPlayerId: id }])),
    planets: Object.fromEntries(
      planets.map((planet) => [planet.id, { id: planet.id, ownerPlayerId: planet.ownerPlayerId, x: planet.x, y: planet.y }]),
    ),
    fleets: Object.fromEntries(playerViewModel.fleets.map((fleet) => [fleet.id, fleet])),
    actions,
  }
}

function isSubmittedAction(action: Action): action is SubmittedAction {
  return action.selectedTargets !== null && action.selectedInputs !== null
}

export type GetPlayerViewDto = z.infer<typeof GetPlayerViewDtoSchema>
export const GetPlayerViewDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  playerId: PlayerIdSchema,
})

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDtoSchema>
export const PlayerViewPlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  color: z.enum(PlayerColor),
  isReady: z.boolean(),
})

export const StarDtoSchema = z.object({
  id: StarIdSchema,
  name: z.string(),
  coordinates: StarCoordinatesSchema,
  x: z.number(),
  y: z.number(),
})

export const PlanetDtoSchema = z.object({
  id: PlanetIdSchema,
  ownerPlayerId: PlayerIdSchema.nullable(),
  name: PlanetNameSchema,
  coordinates: PlanetCoordinatesSchema,
  x: z.number(),
  y: z.number(),
  biome: z.enum(PlanetBiome),
  size: z.enum(PlanetSize),
  fertility: z.number(),
  metal: z.number(),
  fuel: z.number(),
  energy: z.number(),
  maxPopulation: z.number(),
  area: z.number(),
})

export const GalaxyDtoSchema = z.object({
  systems: z.array(
    z.object({
      star: StarDtoSchema,
      planets: z.array(PlanetDtoSchema),
    }),
  ),
})

export const FleetDtoSchema = z.object({
  id: FleetIdSchema,
  ownerPlayerId: PlayerIdSchema,
  name: FleetNameSchema,
  strength: z.number(),
  originPlanetId: PlanetIdSchema,
  destinationPlanetId: PlanetIdSchema.optional(),
  distanceToEnd: NonNegativeNumberSchema.optional(),
  movement: FleetMovementSchema.optional(),
})

type ActionDto = z.infer<typeof ActionDtoSchema>
const ActionDtoSchema = z.object({
  id: ActionIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: SelectedTargetsSchema.nullable(),
  selectedInputs: SelectedInputsSchema.nullable(),
  canAfford: z.boolean(),
  isInProgress: z.boolean(),
})

export type PlayerViewDto = z.infer<typeof PlayerViewDtoSchema>
export const PlayerViewDtoSchema = z.object({
  gameId: GameIdSchema,
  player: PlayerViewPlayerDtoSchema,
  opponents: z.record(PlayerIdSchema, PlayerViewPlayerDtoSchema),
  galaxy: GalaxyDtoSchema,
  fleets: z.array(FleetDtoSchema).readonly(),
  turn: z.number(),
  turnStatus: z.enum(TurnStatus),
  turnEndsAt: z.date(),
  resources: ResourcesDtoSchema,
  ruleset: RulesetSchema,
  actions: z.array(ActionDtoSchema),
})
