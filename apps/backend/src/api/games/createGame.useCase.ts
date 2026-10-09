import { Result } from "@guillaume-docquier/tools-ts"
import { AccountIdSchema } from "shared/domain/accounts/AccountId.ts"
import { GameConfigurationSchema } from "shared/domain/games/GameConfiguration.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { PLAYER_COLOR_PRIORITY } from "shared/domain/players/PlayerColor.ts"
import { z } from "zod"
import { UInt32 } from "#lib/UInt32.ts"
import { MAX_NB_SEATS } from "./GameLimits.ts"
import type { GamesRepository } from "./games.repository.ts"

/**
 * Creates a lobby with its initial status, map seed, and creator's player color.
 */
export class CreateGameUseCase {
  private readonly gamesRepository: GamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async execute(createGameDto: CreateGameDto): Promise<Result<CreatedGameDto, string>> {
    if (createGameDto.configuration.nbSeats > MAX_NB_SEATS) {
      return Result.Failure(`Games cannot have more than ${MAX_NB_SEATS} seats`)
    }

    if (createGameDto.configuration.mapGenerationSeed !== undefined && !UInt32.validate(createGameDto.configuration.mapGenerationSeed)) {
      return Result.Failure(`The seed must be an integer between 0 and ${UInt32.max}`)
    }

    const status = createGameDto.configuration.nbSeats <= 1 ? GameStatus.READY_TO_START : GameStatus.WAITING_FOR_PLAYERS
    return await this.gamesRepository.createGame({
      ...createGameDto,
      mapGenerationSeed: createGameDto.configuration.mapGenerationSeed ?? UInt32.random(),
      status,
      creatorPlayerColor: PLAYER_COLOR_PRIORITY[0],
    })
  }
}

export type CreateGameDto = z.infer<typeof CreateGameDtoSchema>
export const CreateGameDtoSchema = z.object({
  createdByAccountId: AccountIdSchema,
  configuration: GameConfigurationSchema,
})

export type CreatedGameDto = z.infer<typeof CreatedGameDtoSchema>
export const CreatedGameDtoSchema = z.object({
  createdGameId: GameIdSchema,
})
