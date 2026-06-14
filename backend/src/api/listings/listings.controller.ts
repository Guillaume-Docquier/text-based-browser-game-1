import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { GameId } from "#api/shared/GameId.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import type { ListingsRepository } from "./listings.repository.ts"

export class ListingsController {
  private readonly logger: Logger
  private readonly listingsRepository: ListingsRepository

  public constructor({ logger, listingsRepository }: { logger: Logger; listingsRepository: ListingsRepository }) {
    this.logger = logger.child({ scope: "listings-controller" })
    this.listingsRepository = listingsRepository
  }

  /**
   * Gets ALL the game listings. This only makes sense until we have real traffic.
   */
  public async getListings(): Promise<ListingDto[]> {
    const getListingsResults = await this.listingsRepository.getListings()
    if (Result.isFailure(getListingsResults)) {
      this.logger.error("Could not get game listings, returning empty array", { error: getListingsResults.error })
      return []
    }

    return getListingsResults.value
  }
}

export type ListingDto = z.infer<typeof ListingDto>
export const ListingDto = z.object({
  id: GameId,
  name: z.string(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: z.enum(GameStatus),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})
