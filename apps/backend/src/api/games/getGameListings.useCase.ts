import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { GameListing } from "./GameListing.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { GetGameListingsError } from "./getGameListings.error.ts"

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
   * Returns a typed failure when listings cannot be loaded.
   */
  public async execute({ accountId }: { accountId: AccountId | undefined }): Promise<Result<GameListing[], GetGameListingsError>> {
    const getGameListingsResults = await this.gamesRepository.getGameListings({ accountId })
    if (Result.isFailure(getGameListingsResults)) {
      this.logger.error("Could not get game listings", { error: getGameListingsResults.error })
      return getGameListingsResults
    }

    return Result.Success(getGameListingsResults.value)
  }
}
