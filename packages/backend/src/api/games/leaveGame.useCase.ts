import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { LeaveGameCommand } from "./leaveGame.command.ts"
import { LeaveGameError, LeaveGameRollbackError } from "./leaveGame.error.ts"

/**
 * Leaves an unstarted lobby atomically and reopens its available seats.
 */
export class LeaveGameUseCase {
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
    this.logger = logger.child({ scope: "leave-game-use-case" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
  }

  /**
   * Leaving an already left lobby returns a success for idempotency.
   */
  public async execute({ gameId }: LeaveGameCommand, { accountId }: { accountId: AccountId }): Promise<Result<void, LeaveGameError>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const gameForLeave = await this.gamesRepository.getGameForLeave({ gameId }, tx)

      if (!gameForLeave.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (gameForLeave.status !== GameStatus.WAITING_FOR_PLAYERS && gameForLeave.status !== GameStatus.READY_TO_START) {
        throw new LeaveGameRollbackError(LeaveGameError.GAME_ALREADY_STARTED)
      }

      if (gameForLeave.createdByAccountId === accountId) {
        throw new LeaveGameRollbackError(LeaveGameError.CREATOR_CANNOT_LEAVE)
      }

      await this.gamesRepository.leaveGame({ context: gameForLeave, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      if (leaveGameResult.error instanceof LeaveGameRollbackError) {
        return Result.Failure(leaveGameResult.error.code)
      }

      return Result.Failure(LeaveGameError.UNKNOWN)
    }

    return Result.Success(undefined)
  }
}
