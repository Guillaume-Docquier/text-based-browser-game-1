import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { getUncommittedResources } from "shared/action-submission/getUncommittedResources.ts"
import { validateCosts } from "shared/action-submission/validation/costs/validateCosts.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerColorSchema } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import type { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionIdSchema } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { ActionIdSchema } from "shared/domain/turns/actions/ActionId.ts"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { FleetSchema } from "shared/domain/world/fleets/Fleet.ts"
import { GalaxySchema } from "shared/domain/world/Galaxy.ts"
import { z } from "zod"
import { type ResourceAmountsDto, ResourcesDtoSchema } from "#api/gameplay/ResourcesDto.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository, PlayerViewModel } from "./gameplay.repository.ts"
import { GetPlayerViewError } from "./getPlayerView.error.ts"
import type { GetPlayerViewQuery } from "./getPlayerView.query.ts"

/**
 * Reads a player's gameplay view, including resource commitments and Action affordability.
 */
export class GetPlayerViewUseCase {
  private readonly gameplayRepository: GameplayRepository

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  public async execute(
    { gameId }: GetPlayerViewQuery,
    { playerId }: { playerId: PlayerId },
  ): Promise<Result<PlayerViewDto, GetPlayerViewError>> {
    const playerViewResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(playerViewResult)) {
      return playerViewResult
    }

    if (playerViewResult.value === undefined) {
      return Result.Failure(GetPlayerViewError.VIEW_NOT_FOUND)
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

export type PlayerViewPlayerDto = z.infer<typeof PlayerViewPlayerDtoSchema>
export const PlayerViewPlayerDtoSchema = z.object({
  id: PlayerIdSchema,
  color: PlayerColorSchema,
  isReady: z.boolean(),
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
  galaxy: GalaxySchema,
  fleets: z.array(FleetSchema).readonly(),
  turn: z.number(),
  turnStatus: z.enum(TurnStatus),
  turnEndsAt: z.date(),
  resources: ResourcesDtoSchema,
  ruleset: RulesetSchema,
  actions: z.array(ActionDtoSchema),
})
