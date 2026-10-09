import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { MAX_NB_SEATS } from "./GameLimits.ts"
import type { GamesRepository } from "./games.repository.ts"
import { RulesetSummaryDtoSchema } from "./RulesetSummaryDto.ts"

/**
 * Gets the rulesets and seat limit available when creating a lobby.
 */
export class GetGameCreationSettingsUseCase {
  private readonly gamesRepository: GamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async execute(): Promise<Result<GameCreationSettingsDto, string>> {
    const gameCreationSettingsResult = await this.gamesRepository.getGameCreationSettings()
    if (Result.isFailure(gameCreationSettingsResult)) {
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
