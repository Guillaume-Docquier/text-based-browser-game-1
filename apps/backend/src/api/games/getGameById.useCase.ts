import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { GameDetailsDto } from "./GameDetailsDto.ts"
import type { GamesRepository, GameDetailsModel } from "./games.repository.ts"

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
   * Returns undefined when the game does not exist or cannot be loaded.
   */
  public async execute({ gameId, playerId }: { gameId: GameId; playerId: PlayerId | undefined }): Promise<GameDetailsDto | undefined> {
    const gameResult = await this.gamesRepository.getGameById({ gameId })
    if (Result.isFailure(gameResult)) {
      this.logger.error("Could not get game details, returning undefined", { gameId, playerId, error: gameResult.error })
      return undefined
    }

    const gameModel = gameResult.value
    if (gameModel === undefined) {
      return undefined
    }

    return toGameDetailsDto({ gameModel, playerId })
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
