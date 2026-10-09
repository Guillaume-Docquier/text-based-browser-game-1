import { branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { rollbackOnFailure } from "#lib/db/drizzle/rollbackOnFailure.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { couldNot } from "#lib/errors.ts"
import type { GamesRepository } from "./games.repository.ts"

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
  public async execute({ gameId, accountId }: LeaveGameDto): Promise<Result<void, string>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const gameForLeave = await this.gamesRepository.getGameForLeave({ gameId }, tx)
      rollbackOnFailure(gameForLeave, "Failed to get lobby.")

      if (!gameForLeave.value.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (gameForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && gameForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("Cannot leave a lobby that has started.")
      }

      if (gameForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollbackError("Cannot leave a lobby as its creator.")
      }

      await this.gamesRepository.leaveGame({ context: gameForLeave.value, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(undefined)
  }
}

export type LeaveGameDto = z.infer<typeof LeaveGameDtoSchema>
export const LeaveGameDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})
