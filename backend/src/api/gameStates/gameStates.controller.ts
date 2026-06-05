import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository, type PlayerGameStateModel } from "#lib/db/gameStates.repository.ts"

export class GameStatesController {
  private readonly gameStatesRepository: GameStatesRepository

  public constructor({ gameStatesRepository }: { gameStatesRepository: GameStatesRepository }) {
    this.gameStatesRepository = gameStatesRepository
  }

  public async getById({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameState | undefined, string>> {
    const gameStateResult = await this.gameStatesRepository.getByGameIdAndPlayerId({ gameId, playerId })
    if (Result.isFailure(gameStateResult)) {
      return gameStateResult
    }

    if (gameStateResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toGameState(gameStateResult.value))
  }
}

function toGameState(playerGameStateModel: PlayerGameStateModel): GameState {
  return {
    gameId: playerGameStateModel.gameId,
    playerId: playerGameStateModel.playerId,
    tick: playerGameStateModel.tick,
    nextTickAt: playerGameStateModel.nextTickAt,
    resources: playerGameStateModel.resources,
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
