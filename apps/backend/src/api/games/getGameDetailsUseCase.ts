import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { GameDetails } from "./GameDetails.ts"
import type { GamesRepository, GameDetailsWithoutOps } from "./games.repository.ts"
import type { GetGameByIdError } from "./getGameById.error.ts"
import type { GetGameByIdQuery } from "./getGameById.query.ts"

/**
 * Gets public game details and the operations available to the requesting player.
 */
export class GetGameDetailsUseCase {
  private readonly logger: Logger
  private readonly gamesRepository: GamesRepository

  public constructor({ logger, gamesRepository }: { logger: Logger; gamesRepository: GamesRepository }) {
    this.logger = logger.child({ scope: "get-game-details-use-case" })
    this.gamesRepository = gamesRepository
  }

  public async execute(
    { gameId }: GetGameByIdQuery,
    { accountId }: { accountId: AccountId | undefined },
  ): Promise<Result<GameDetails, GetGameByIdError>> {
    const playerId = accountId === undefined ? undefined : branded<PlayerId>(accountId)
    const getGameDetailsResult = await this.gamesRepository.getGameDetails({ gameId })
    if (Result.isFailure(getGameDetailsResult)) {
      this.logger.error("Could not get game by id", { gameId, accountId, error: getGameDetailsResult.error })
      return getGameDetailsResult
    }

    const gameModel = getGameDetailsResult.value

    return Result.Success(toGameDetails({ gameModel, playerId }))
  }
}

function toGameDetails({ gameModel, playerId }: { gameModel: GameDetailsWithoutOps; playerId: PlayerId | undefined }): GameDetails {
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
    canJoin,
    canLeave,
    canStart,
    canOpen,
  }
}
