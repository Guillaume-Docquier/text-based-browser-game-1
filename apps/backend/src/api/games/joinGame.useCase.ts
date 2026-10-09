import { Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PLAYER_COLOR_PRIORITY } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { z } from "zod"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { rollbackOnFailure } from "#lib/db/drizzle/rollbackOnFailure.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { couldNot } from "#lib/errors.ts"
import type { GamesRepository } from "./games.repository.ts"

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
  public async execute({ gameId, accountId }: JoinGameDto): Promise<Result<void, string>> {
    const playerId = branded<PlayerId>(accountId)
    const joinGameResult = await this.createTransaction(async (tx) => {
      const gameForJoin = await this.gamesRepository.getGameForJoin({ gameId }, tx)
      rollbackOnFailure(gameForJoin, "Failed to get lobby.")

      if (gameForJoin.value.players.find((player) => player.id === playerId) !== undefined) {
        // Already part of the game, return a success for idempotency
        return
      }

      if (gameForJoin.value.status !== GameStatus.WAITING_FOR_PLAYERS) {
        throw new TransactionRollbackError("Cannot join lobby, it is full.")
      }

      const status =
        gameForJoin.value.players.length + 1 >= gameForJoin.value.nbSeats ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS

      const usedColors = new Set(gameForJoin.value.players.map((player) => player.color))
      const color = PLAYER_COLOR_PRIORITY.find((candidateColor) => !usedColors.has(candidateColor))
      Assert.isDefined(color)

      await this.gamesRepository.joinGame({ context: gameForJoin.value, playerId, color, status }, tx)
    })

    if (Result.isFailure(joinGameResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinGameResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameResult
  }
}

export type JoinGameDto = z.infer<typeof JoinGameDtoSchema>
export const JoinGameDtoSchema = z.object({
  gameId: GameIdSchema,
  accountId: AccountIdSchema,
})
