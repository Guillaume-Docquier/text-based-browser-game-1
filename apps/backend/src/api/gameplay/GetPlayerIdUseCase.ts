import type { Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"

/**
 * Finds the Player corresponding to an Account in a game.
 */
export class GetPlayerIdUseCase {
  private readonly gameplayRepository: GameplayRepository

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  /**
   * Returns no Player when the Account has not joined the game.
   */
  public async execute({ gameId, accountId }: { gameId: GameId; accountId: AccountId }): Promise<Result<PlayerId | undefined, string>> {
    return await this.gameplayRepository.getPlayerId({ gameId, accountId })
  }
}
