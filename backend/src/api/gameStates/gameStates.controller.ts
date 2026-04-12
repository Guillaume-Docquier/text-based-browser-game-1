import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository } from "#lib/db/gameStates.repository.ts"

export class GameStatesController {
  private readonly gameStatesRepository: GameStatesRepository
  private readonly logger: Logger

  public constructor({ gameStatesRepository, logger }: { gameStatesRepository: GameStatesRepository; logger: Logger }) {
    this.gameStatesRepository = gameStatesRepository
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

    return Result.Success({
      gameId,
      playerId,
      tick: gameStateResult.value.tick,
      nextTickAt: gameStateResult.value.nextTickAt,
    })
  }
}

export type GameState = z.infer<typeof GameState>
export const GameState = z.object({
  gameId: z.number(),
  playerId: z.number(),
  tick: z.number(),
  nextTickAt: z.date(),
})
