import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { GameDetailsDto } from "./GameDetailsDto.ts"
import type { GamesRepository, GameDetailsModel } from "./games.repository.ts"
import { GetGameByIdError } from "./getGameById.error.ts"

/**
 * Gets public game details and the operations available to the requesting player.
 */
export class GetGameByIdUseCase {
  private readonly logger: Logger
  private readonly gamesRepository: GamesRepository

  public constructor({ logger, gamesRepository }: { logger: Logger; gamesRepository: GamesRepository }) {
    this.logger = logger.child({ scope: "get-game-by-id-use-case" })
    this.gamesRepository = gamesRepository
  }

  /**
   * Distinguishes missing games from persistence failures.
   */
  public async execute({
    gameId,
    playerId,
  }: {
    gameId: GameId
    playerId: PlayerId | undefined
  }): Promise<Result<GameDetailsDto, GetGameByIdError>> {
    const getGameByIdResult = await this.gamesRepository.getGameById({ gameId })
    if (Result.isFailure(getGameByIdResult)) {
      this.logger.error("Could not get game by id", { gameId, playerId, error: getGameByIdResult.error })
      return getGameByIdResult
    }

    const gameModel = getGameByIdResult.value
    if (gameModel === undefined) {
      return Result.Failure(GetGameByIdError.GAME_NOT_FOUND)
    }

    return Result.Success(toGameDetailsDto({ gameModel, playerId }))
  }
}

function toGameDetailsDto({ gameModel, playerId }: { gameModel: GameDetailsModel; playerId: PlayerId | undefined }): GameDetailsDto {
  const status = gameModel.status

  const canJoin =
    playerId !== undefined && status === GameStatus.WAITING_FOR_PLAYERS && gameModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    gameModel.creator.id !== playerId &&
    gameModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameStatus.WAITING_FOR_PLAYERS || status === GameStatus.READY_TO_START) &&
    gameModel.creator.id === playerId

  const canOpen = status === GameStatus.IN_PROGRESS && gameModel.players.some((player) => player.id === playerId)

  return {
    ...gameModel,
    status,
    canJoin,
    canLeave,
    canStart,
    canOpen,
  }
}
