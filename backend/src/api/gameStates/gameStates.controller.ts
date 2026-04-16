import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository, type PlayerGameStateRow } from "#lib/db/gameStates.repository.ts"

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

function toGameState(gameStateRow: PlayerGameStateRow): GameState {
  return {
    gameId: gameStateRow.gameId,
    playerId: gameStateRow.playerId,
    tick: gameStateRow.tick,
    nextTickAt: gameStateRow.nextTickAt,
    resources: gameStateRow.resources,
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
