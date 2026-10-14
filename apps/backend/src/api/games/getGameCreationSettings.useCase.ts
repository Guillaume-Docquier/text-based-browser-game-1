import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { MAX_NB_SEATS } from "./GameLimits.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { GetGameCreationSettingsError } from "./getGameCreationSettings.error.ts"
import type { GetGameCreationSettingsQuery } from "./getGameCreationSettings.query.ts"
import { RulesetSummaryDtoSchema } from "./RulesetSummaryDto.ts"

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

  public async execute(_query: GetGameCreationSettingsQuery): Promise<Result<GameCreationSettingsDto, GetGameCreationSettingsError>> {
    const gameCreationSettingsResult = await this.gamesRepository.getGameCreationSettings()
    if (Result.isFailure(gameCreationSettingsResult)) {
      this.logger.error("Could not get game creation settings", { error: gameCreationSettingsResult.error })
      return gameCreationSettingsResult
    }

    return Result.Success({
      maxNbSeats: MAX_NB_SEATS,
      ...gameCreationSettingsResult.value,
    })
  }
}

export type GameCreationSettingsDto = z.infer<typeof GameCreationSettingsDtoSchema>
export const GameCreationSettingsDtoSchema = z.object({
  maxNbSeats: z.number(),
  rulesets: z.array(RulesetSummaryDtoSchema).readonly(),
})
