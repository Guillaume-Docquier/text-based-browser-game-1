import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { NonNegativeNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { getUncommittedResources } from "shared/action-submission/getUncommittedResources.ts"
import { validateCosts } from "shared/action-submission/validation/costs/validateCosts.ts"
import { ActionIdSchema } from "shared/domain/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/actions/SelectedTargets.ts"
import { GameIdSchema } from "shared/domain/game/GameId.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import type { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionIdSchema } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
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
import { createTurnState } from "./createTurnState.ts"
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
  const uncommittedResources =
    playerViewModel.turnStatus === TurnStatus.COMPLETED
      ? playerViewModel.resources // When the turn is completed, at action costs have been spent already, so we don't need to compute commitments
      : getUncommittedResources({
          resources: playerViewModel.resources,
          actions: playerViewModel.actions.filter((action) => action.selectedTargets !== null),
          ruleset: playerViewModel.ruleset,
        })

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
    actions: toActionDtos(playerViewModel, uncommittedResources),
  }
}

function toResourcesDto(totalResources: Readonly<Resources>, uncommittedResources: Readonly<Resources>): PlayerViewDto["resources"] {
  // string instead of ResourceType to satisfy TypeScript. Strange that it works, maybe even dangerous, but okay
  return Object.entries(totalResources).reduce<Record<string, ResourceAmountsDto>>((resourcesDto, [resourceType, total]) => {
    resourcesDto[resourceType] = {
      total,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Object.entries widens keys from the Resources record, which are ResourceType values.
      uncommitted: uncommittedResources[resourceType as ResourceType] ?? 0,
    }
    return resourcesDto
  }, {})
}

function toActionDtos(playerViewModel: PlayerViewModel, uncommittedResources: Resources): ActionDto[] {
  const turnState = createTurnState({
    gameId: playerViewModel.gameId,
    turn: playerViewModel.turn,
    playerId: playerViewModel.player.id,
    resources: uncommittedResources,
    submittedActions: [],
    planets: [], // doesn't matter for cost validation
    fleets: [], // doesn't matter for cost validation
  })

  return playerViewModel.actions.map((action) => {
    if (action.selectedTargets !== null) {
      // If the action is submitted already (selected targets are defined), then the action is affordable because it's been committed already
      return {
        ...action,
        canAfford: true,
      }
    }

    const affordabilityResult = validateCosts(
      [
        {
          ...action,
          playerId: playerViewModel.player.id,
          selectedTargets: {},
        },
      ],
      playerViewModel.ruleset,
      turnState,
    )
    Assert.isSuccess(affordabilityResult)

    return {
      ...action,
      canAfford: affordabilityResult.value.length === 0,
    }
  })
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
})

type ActionDto = z.infer<typeof ActionDtoSchema>
const ActionDtoSchema = z.object({
  id: ActionIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
  selectedTargets: SelectedTargetsSchema.nullable(),
  canAfford: z.boolean(),
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
