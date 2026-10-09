import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { GameSummaryDto } from "./GameSummaryDto.ts"

/**
 * Gets all game summaries, including whether the requesting account has joined.
 */
export class GetGameSummariesUseCase {
  private readonly logger: Logger
  private readonly gamesRepository: GamesRepository

  public constructor({ logger, gamesRepository }: { logger: Logger; gamesRepository: GamesRepository }) {
    this.logger = logger.child({ scope: "get-game-summaries-use-case" })
    this.gamesRepository = gamesRepository
  }

  /**
   * Returns an empty list when summaries cannot be loaded.
   */
  public async execute({ accountId }: { accountId: AccountId | undefined }): Promise<GameSummaryDto[]> {
    const getGameSummariesResults = await this.gamesRepository.getGameSummaries({ accountId })
    if (Result.isFailure(getGameSummariesResults)) {
      this.logger.error("Could not get game summaries, returning empty array", { error: getGameSummariesResults.error })
      return []
    }

    return getGameSummariesResults.value
  }
}
