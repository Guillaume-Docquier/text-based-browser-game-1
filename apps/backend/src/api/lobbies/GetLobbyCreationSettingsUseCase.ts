import { Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { LobbiesRepository } from "./lobbies.repository.ts"
import { MAX_NB_SEATS } from "./LobbyLimits.ts"
import { RulesetSummaryDtoSchema } from "./RulesetSummaryDto.ts"

/**
 * Gets the rulesets and seat limit available when creating a lobby.
 */
export class GetLobbyCreationSettingsUseCase {
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({ lobbiesRepository }: { lobbiesRepository: LobbiesRepository }) {
    this.lobbiesRepository = lobbiesRepository
  }

  public async execute(): Promise<Result<LobbyCreationSettingsDto, string>> {
    const lobbyCreationSettingsResult = await this.lobbiesRepository.getLobbyCreationSettings()
    if (Result.isFailure(lobbyCreationSettingsResult)) {
      return lobbyCreationSettingsResult
    }

    return Result.Success({
      maxNbSeats: MAX_NB_SEATS,
      ...lobbyCreationSettingsResult.value,
    })
  }
}

export type LobbyCreationSettingsDto = z.infer<typeof LobbyCreationSettingsDtoSchema>
export const LobbyCreationSettingsDtoSchema = z.object({
  maxNbSeats: z.number(),
  rulesets: z.array(RulesetSummaryDtoSchema).readonly(),
})
