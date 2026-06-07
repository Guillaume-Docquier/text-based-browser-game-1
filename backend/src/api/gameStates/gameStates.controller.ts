import { Result } from "@guillaume-docquier/tools-ts"
import z from "zod"
import { type GameStatesRepository, type PlayerGameStateModel } from "#lib/db/gameStates.repository.ts"
import type { PlayersRepository } from "#lib/db/games/players.repository.ts"

export class GameStatesController {
  private readonly gameStatesRepository: GameStatesRepository
  private readonly playersRepository: PlayersRepository

  public constructor({
    gameStatesRepository,
    playersRepository,
  }: {
    gameStatesRepository: GameStatesRepository
    playersRepository: PlayersRepository
  }) {
    this.gameStatesRepository = gameStatesRepository
    this.playersRepository = playersRepository
  }

  public async getById({ gameId, accountId }: { gameId: number; accountId: string }): Promise<Result<GameStateDto | undefined, string>> {
    const playerResult = await this.playersRepository.getByGameIdAndAccountId({ gameId, accountId })
    if (Result.isFailure(playerResult)) {
      return playerResult
    }
    if (playerResult.value === undefined) {
      return Result.Failure("Account does not have a player in this game.")
    }

    const gameStateResult = await this.gameStatesRepository.getByGameIdAndPlayerId({ gameId, playerId: playerResult.value.id })
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
  gameId: z.number(),
  playerId: z.string(),
  tick: z.number(),
  nextTickAt: z.date(),
  resources: z.object({
    money: z.number(),
  }),
})
