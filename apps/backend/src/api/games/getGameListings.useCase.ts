import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { GameListingDto } from "./GameListingDto.ts"
import type { GamesRepository } from "./games.repository.ts"

/**
 * Gets all game listings, including whether the requesting account has joined.
 */
export class GetGameListingsUseCase {
  private readonly logger: Logger
  private readonly gamesRepository: GamesRepository

  public constructor({ logger, gamesRepository }: { logger: Logger; gamesRepository: GamesRepository }) {
    this.logger = logger.child({ scope: "get-game-listings-use-case" })
    this.gamesRepository = gamesRepository
  }

  /**
   * Returns an empty list when listings cannot be loaded.
   */
  public async execute({ accountId }: { accountId: AccountId | undefined }): Promise<GameListingDto[]> {
    const getGameListingsResults = await this.gamesRepository.getGameListings({ accountId })
    if (Result.isFailure(getGameListingsResults)) {
      this.logger.error("Could not get game listings, returning empty array", { error: getGameListingsResults.error })
      return []
    }

    return getGameListingsResults.value
  }
}
