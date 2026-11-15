import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameCreationSettings } from "#api/games/gameCreationSettings.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { GetGameCreationSettingsError } from "./getGameCreationSettings.error.ts"

/**
 * Gets the rulesets and seat limit available when creating a lobby.
 */
export class GetGameCreationSettingsUseCase {
  private readonly logger: Logger
  private readonly gamesRepository: GamesRepository

  public constructor({ logger, gamesRepository }: { logger: Logger; gamesRepository: GamesRepository }) {
    this.logger = logger.child({ scope: "get-game-creation-settings-use-case" })
    this.gamesRepository = gamesRepository
  }

  public async execute(): Promise<Result<GameCreationSettings, GetGameCreationSettingsError>> {
    const gameCreationSettingsResult = await this.gamesRepository.getGameCreationSettings()
    if (Result.isFailure(gameCreationSettingsResult)) {
      this.logger.error("Could not get game creation settings", { error: gameCreationSettingsResult.error })
      return gameCreationSettingsResult
    }

    return gameCreationSettingsResult
  }
}
