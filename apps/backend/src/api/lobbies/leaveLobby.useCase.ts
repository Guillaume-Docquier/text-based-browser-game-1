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
import type { LobbiesRepository } from "./lobbies.repository.ts"

/**
 * Leaves an unstarted lobby atomically and reopens its available seats.
 */
export class LeaveLobbyUseCase {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({
    logger,
    createTransaction,
    lobbiesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    lobbiesRepository: LobbiesRepository
  }) {
    this.logger = logger.child({ scope: "leave-lobby-use-case" })
    this.createTransaction = createTransaction
    this.lobbiesRepository = lobbiesRepository
  }

  /**
   * Leaving an already left lobby returns a success for idempotency.
   */
  public async execute({ gameId, accountId }: LeaveLobbyDto): Promise<Result<void, string>> {
    const playerId = branded<PlayerId>(accountId)
    const leaveGameResult = await this.createTransaction(async (tx) => {
      const lobbyForLeave = await this.lobbiesRepository.getLobbyForLeave({ gameId }, tx)
      rollbackOnFailure(lobbyForLeave, "Failed to get lobby.")

      if (!lobbyForLeave.value.playerIds.includes(playerId)) {
        // Already not in the game, return a success for idempotency
        return
      }

      if (lobbyForLeave.value.status !== GameStatus.WAITING_FOR_PLAYERS && lobbyForLeave.value.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("Cannot leave a lobby that has started.")
      }

      if (lobbyForLeave.value.createdByAccountId === accountId) {
        throw new TransactionRollbackError("Cannot leave a lobby as its creator.")
      }

      await this.lobbiesRepository.leaveLobby({ context: lobbyForLeave.value, playerId, status: GameStatus.WAITING_FOR_PLAYERS }, tx)
    })

    if (Result.isFailure(leaveGameResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: leaveGameResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(undefined)
  }
}

export type LeaveLobbyDto = z.infer<typeof LeaveLobbyDtoSchema>
export const LeaveLobbyDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})
