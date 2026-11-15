import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { UpdateReadinessError, UpdateReadinessRollbackError } from "#api/gameplay/updateReadiness.error.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { UpdateReadinessCommand } from "./updateReadiness.command.ts"

/**
 * Updates a player's Readiness and closes the Turn when all players are Ready.
 */
export class UpdateReadinessUseCase {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gameplayRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "update-readiness-use-case" })
    this.clock = clock
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
  }

  /**
   * Changes Readiness and checks for unanimous Readiness within one Turn transaction.
   */
  public async execute(
    { gameId, turn, isReady }: UpdateReadinessCommand,
    { playerId }: { playerId: PlayerId },
  ): Promise<Result<void, UpdateReadinessError>> {
    const result = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.getReadinessForUpdate({ gameId, playerId, turn }, tx)

      await this.gameplayRepository.updateReadiness({ context, isReady }, tx)

      const allPlayersAreReady = context.players.every((player) => (player.id === playerId ? isReady : player.isReady))
      if (allPlayersAreReady) {
        await this.gameplayRepository.closeTurn({ context, closedAt: this.clock.now() }, tx)
      }
    })

    if (Result.isFailure(result)) {
      this.logger.error("Could not update readiness", { gameId, turn, playerId, error: result.error })
      if (result.error instanceof UpdateReadinessRollbackError) {
        return Result.Failure(result.error.code)
      }

      return Result.Failure(UpdateReadinessError.UNKNOWN)
    }

    return Result.Success(undefined)
  }
}
