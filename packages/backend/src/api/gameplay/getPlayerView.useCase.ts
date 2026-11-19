import type { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { PlayerView } from "#api/gameplay/PlayerView.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { GetPlayerViewError } from "./getPlayerView.error.ts"
import type { GetPlayerViewQuery } from "./getPlayerView.query.ts"

/**
 * Reads a player's gameplay view.
 */
export class GetPlayerViewUseCase {
  private readonly gameplayRepository: GameplayRepository

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  public async execute(
    { gameId }: GetPlayerViewQuery,
    { playerId }: { playerId: PlayerId },
  ): Promise<Result<PlayerView, GetPlayerViewError>> {
    return await this.gameplayRepository.getPlayerView({ gameId, playerId })
  }
}
