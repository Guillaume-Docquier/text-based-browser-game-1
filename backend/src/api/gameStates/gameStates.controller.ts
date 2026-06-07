import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository, type PlayerGameStateModel } from "#lib/db/gameStates.repository.ts"
import { PlayerId } from "#api/games/PlayerId.ts"
import { GameId } from "#api/games/GameId.ts"

export class GameStatesController {
  private readonly gameStatesRepository: GameStatesRepository

  public constructor({ gameStatesRepository }: { gameStatesRepository: GameStatesRepository }) {
    this.gameStatesRepository = gameStatesRepository
  }

  public async getById({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<GameStateDto | undefined, string>> {
    const gameStateResult = await this.gameStatesRepository.getByGameIdAndPlayerId({ gameId, playerId })
    if (Result.isFailure(gameStateResult)) {
      return gameStateResult
    }

    if (gameStateResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toGameStateDto(gameStateResult.value))
  }
}

function toGameStateDto(playerGameStateModel: PlayerGameStateModel): GameStateDto {
  return {
    gameId: playerGameStateModel.gameId,
    playerId: playerGameStateModel.playerId,
    tick: playerGameStateModel.tick,
    nextTickAt: playerGameStateModel.nextTickAt,
    resources: playerGameStateModel.resources,
  }
}

export type GameStateDto = z.infer<typeof GameStateDto>
export const GameStateDto = z.object({
  gameId: GameId,
  playerId: PlayerId,
  tick: z.number(),
  nextTickAt: z.date(),
  resources: z.object({
    money: z.number(),
  }),
})
