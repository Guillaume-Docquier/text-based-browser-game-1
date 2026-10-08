import { Result } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PLAYER_COLOR_PRIORITY } from "shared/domain/players/PlayerColor.ts"
import { RulesetIdSchema } from "shared/domain/ruleset/RulesetId.ts"
import { z } from "zod"
import { UInt32 } from "#lib/UInt32.ts"
import type { LobbiesRepository } from "./lobbies.repository.ts"
import { MAX_NB_SEATS } from "./LobbyLimits.ts"

/**
 * Creates a lobby with its initial status, map seed, and creator's player color.
 */
export class CreateLobbyUseCase {
  private readonly lobbiesRepository: LobbiesRepository

  public constructor({ lobbiesRepository }: { lobbiesRepository: LobbiesRepository }) {
    this.lobbiesRepository = lobbiesRepository
  }

  public async execute(createLobbyDto: CreateLobbyDto): Promise<Result<CreatedLobbyDto, string>> {
    if (createLobbyDto.configuration.nbSeats > MAX_NB_SEATS) {
      return Result.Failure(`Games cannot have more than ${MAX_NB_SEATS} seats`)
    }

    if (createLobbyDto.configuration.mapGenerationSeed !== undefined && !UInt32.validate(createLobbyDto.configuration.mapGenerationSeed)) {
      return Result.Failure(`The seed must be an integer between 0 and ${UInt32.max}`)
    }

    const status = createLobbyDto.configuration.nbSeats <= 1 ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS
    return await this.lobbiesRepository.createLobby({
      ...createLobbyDto,
      mapGenerationSeed: createLobbyDto.configuration.mapGenerationSeed ?? UInt32.random(),
      status,
      creatorPlayerColor: PLAYER_COLOR_PRIORITY[0],
    })
  }
}

export type CreateLobbyConfigurationDto = z.infer<typeof CreateLobbyConfigurationDtoSchema>
export const CreateLobbyConfigurationDtoSchema = z.object({
  name: z.string(),
  nbSeats: z.number(),
  turnIntervalSeconds: z.number(),
  mapGenerationSeed: z.number().exactOptional(),
  rulesetId: RulesetIdSchema,
})

export type CreateLobbyDto = z.infer<typeof CreateLobbyDtoSchema>
export const CreateLobbyDtoSchema = z.object({
  createdByAccountId: AccountIdSchema,
  configuration: CreateLobbyConfigurationDtoSchema,
})

export type CreatedLobbyDto = z.infer<typeof CreatedLobbyDtoSchema>
export const CreatedLobbyDtoSchema = z.object({
  createdGameId: GameIdSchema,
})
