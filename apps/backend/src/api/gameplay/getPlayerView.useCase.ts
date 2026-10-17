import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { getUncommittedResources } from "shared/action-submission/getUncommittedResources.ts"
import { validateCosts } from "shared/action-submission/validation/costs/validateCosts.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import type { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { PlayerViewAction, PlayerView } from "#api/gameplay/PlayerView.ts"
import type { PlayerViewResourceAmounts } from "#api/gameplay/PlayerViewResources.ts"
import { createTurnState } from "./createTurnState.ts"
import type { GameplayRepository, PlayerViewModel } from "./gameplay.repository.ts"
import type { GetPlayerViewError } from "./getPlayerView.error.ts"
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
  ): Promise<Result<PlayerView, GetPlayerViewError>> {
    const playerViewResult = await this.gameplayRepository.getPlayerView({ gameId, playerId })
    if (Result.isFailure(playerViewResult)) {
      return playerViewResult
    }

    return Result.Success(toPlayerView(playerViewResult.value))
  }
}

function toPlayerView(playerViewModel: PlayerViewModel): PlayerView {
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
    resources: toPlayerViewResources(playerViewModel.resources, uncommittedResources),
    ruleset: playerViewModel.ruleset,
    actions: toPlayerViewActions(playerViewModel, uncommittedResources),
  }
}

function toPlayerViewResources(totalResources: Readonly<Resources>, uncommittedResources: Readonly<Resources>): PlayerView["resources"] {
  // string instead of ResourceType to satisfy TypeScript. Strange that it works, maybe even dangerous, but okay
  return Object.entries(totalResources).reduce<Record<string, PlayerViewResourceAmounts>>((playerViewResources, [resourceType, total]) => {
    playerViewResources[resourceType] = {
      total,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Object.entries widens keys from the Resources record, which are ResourceType values.
      uncommitted: uncommittedResources[resourceType as ResourceType] ?? 0,
    }
    return playerViewResources
  }, {})
}

function toPlayerViewActions(playerViewModel: PlayerViewModel, uncommittedResources: Resources): PlayerViewAction[] {
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
