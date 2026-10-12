import { branded, type Logger, Result, TypeGuard } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { rollbackOnFailure } from "#lib/db/drizzle/rollbackOnFailure.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import type { GamesRepository } from "./games.repository.ts"
import { LeaveGameError } from "./leaveGame.error.ts"

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
  public async execute({ gameId, accountId }: LeaveGameDto): Promise<Result<void, LeaveGameError>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const gameForLeave = await this.gamesRepository.getGameForLeave({ gameId }, tx)
      rollbackOnFailure(gameForLeave, "Failed to get lobby.")

      if (!gameForLeave.value.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (gameForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && gameForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("Game already started", { cause: LeaveGameError.GAME_ALREADY_STARTED })
      }

      if (gameForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollbackError("Creator cannot leave", { cause: LeaveGameError.CREATOR_CANNOT_LEAVE })
      }

      await this.gamesRepository.leaveGame({ context: gameForLeave.value, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      if (
        leaveGameResult.error instanceof TransactionRollbackError &&
        TypeGuard.isEnumMember(LeaveGameError, leaveGameResult.error.cause)
      ) {
        return Result.Failure(leaveGameResult.error.cause)
      }

      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(LeaveGameError.UNKNOWN)
    }

    return Result.Success(undefined)
  }
}

export type LeaveGameDto = z.infer<typeof LeaveGameDtoSchema>
export const LeaveGameDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})
