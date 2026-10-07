import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { PlayerIdSchema } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"

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
  public async execute({ gameId, turn, playerId, isReady }: UpdateReadinessDto): Promise<Result<void, string>> {
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
      return Result.Failure(result.error.message)
    }

    return Result.Success(undefined)
  }
}

export type UpdateReadinessDto = z.infer<typeof UpdateReadinessDtoSchema>
export const UpdateReadinessDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  turn: z.coerce.number(),
  playerId: PlayerIdSchema,
  isReady: z.boolean(),
})
