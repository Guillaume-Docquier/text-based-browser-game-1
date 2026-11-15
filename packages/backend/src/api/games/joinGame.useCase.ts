import { Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PLAYER_COLOR_PRIORITY } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { JoinGameCommand } from "./joinGame.command.ts"
import { JoinGameError, JoinGameRollbackError } from "./joinGame.error.ts"

/**
 * Joins a lobby atomically, assigning an unused player color and updating its status.
 */
export class JoinGameUseCase {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gamesRepository: GamesRepository

  public constructor({
    logger,
    createTransaction,
    gamesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gamesRepository: GamesRepository
  }) {
    this.logger = logger.child({ scope: "join-game-use-case" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
  }

  /**
   * Joining an already joined lobby returns a success for idempotency.
   */
  public async execute({ gameId }: JoinGameCommand, { accountId }: { accountId: AccountId }): Promise<Result<void, JoinGameError>> {
    const playerId = branded<PlayerId>(accountId)
    const joinGameResult = await this.createTransaction(async (tx) => {
      const gameForJoin = await this.gamesRepository.getGameForJoin({ gameId }, tx)

      if (gameForJoin.players.find((player) => player.id === playerId) !== undefined) {
        // Already part of the game, return a success for idempotency
        return
      }

      if (gameForJoin.status !== GameStatus.WAITING_FOR_PLAYERS && gameForJoin.status !== GameStatus.READY_TO_START) {
        throw new JoinGameRollbackError(JoinGameError.GAME_ALREADY_STARTED)
      }

      if (gameForJoin.status !== GameStatus.WAITING_FOR_PLAYERS) {
        throw new JoinGameRollbackError(JoinGameError.LOBBY_FULL)
      }

      const status = gameForJoin.players.length + 1 >= gameForJoin.nbSeats ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS

      const usedColors = new Set(gameForJoin.players.map((player) => player.color))
      const color = PLAYER_COLOR_PRIORITY.find((candidateColor) => !usedColors.has(candidateColor))
      Assert.isDefined(color)

      await this.gamesRepository.joinGame({ context: gameForJoin, playerId, color, status }, tx)
    })

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinGameResult.error })
      if (joinGameResult.error instanceof JoinGameRollbackError) {
        return Result.Failure(joinGameResult.error.code)
      }

      return Result.Failure(JoinGameError.UNKNOWN)
    }

    return joinGameResult
  }
}
