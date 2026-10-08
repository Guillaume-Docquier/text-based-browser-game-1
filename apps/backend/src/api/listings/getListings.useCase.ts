import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { z } from "zod"
import type { ListingsRepository } from "./listings.repository.ts"

/**
 * Gets all game listings, including whether the requesting account has joined.
 */
export class GetListingsUseCase {
  private readonly logger: Logger
  private readonly listingsRepository: ListingsRepository

  public constructor({ logger, listingsRepository }: { logger: Logger; listingsRepository: ListingsRepository }) {
    this.logger = logger.child({ scope: "get-listings-use-case" })
    this.listingsRepository = listingsRepository
  }

  /**
   * Returns an empty list when listings cannot be loaded.
   */
  public async execute({ playerId }: { playerId: AccountId | undefined }): Promise<ListingDto[]> {
    const getListingsResults = await this.listingsRepository.getListings({ playerId })
    if (Result.isFailure(getListingsResults)) {
      this.logger.error("Could not get game listings, returning empty array", { error: getListingsResults.error })
      return []
    }

    return getListingsResults.value
  }
}

export type ListingDto = z.infer<typeof ListingDtoSchema>
export const ListingDtoSchema = z.object({
  id: GameIdSchema,
  name: z.string(),
  hasJoined: z.boolean(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: z.enum(GameStatus),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})
