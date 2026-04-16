import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { type GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { ResourceType } from "#lib/gameResources.ts"

export class GameStatesController {
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gamePlayerResourcesRepository: GamePlayerResourcesRepository
  private readonly logger: Logger

  public constructor({
    gameStatesRepository,
    gamePlayerResourcesRepository,
    logger,
  }: {
    gameStatesRepository: GameStatesRepository
    gamePlayerResourcesRepository: GamePlayerResourcesRepository
    logger: Logger
  }) {
    this.gameStatesRepository = gameStatesRepository
    this.gamePlayerResourcesRepository = gamePlayerResourcesRepository
    this.logger = logger.child({ scope: "game-states-controller" })
  }

  public async getById({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameState | undefined, string>> {
    const gameStateResult = await this.gameStatesRepository.getById({ gameId })
    if (Result.isFailure(gameStateResult)) {
      return gameStateResult
    }

    if (gameStateResult.value === undefined) {
      return Result.Success(undefined)
    }

    const playerResourcesResult = await this.gamePlayerResourcesRepository.getByGameAndPlayer({ gameId, playerId })
    if (Result.isFailure(playerResourcesResult)) {
      this.logger.error("Could not get player resources for game state", { gameId, playerId, error: playerResourcesResult.error })
      return playerResourcesResult
    }

    const money = playerResourcesResult.value.find((resource) => resource.resourceType === ResourceType.MONEY)
    Assert.isDefined(money)

    return Result.Success({
      gameId,
      playerId,
      tick: gameStateResult.value.tick,
      nextTickAt: gameStateResult.value.nextTickAt,
      resources: {
        // This should be generic, when I have to add a new one here, let's change it to resources.reduce
        money: money.amount,
      },
    })
  }
}

export type GameState = z.infer<typeof GameState>
export const GameState = z.object({
  gameId: z.number(),
  playerId: z.number(),
  tick: z.number(),
  nextTickAt: z.date(),
  resources: z.object({
    money: z.number(),
  }),
})
