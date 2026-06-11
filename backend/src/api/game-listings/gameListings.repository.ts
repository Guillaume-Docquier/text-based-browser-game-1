import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { count, eq } from "drizzle-orm"
import type { GameId } from "#api/games/GameId.ts"
import { computeGameStatus, type GameStatus } from "#api/shared/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, playersTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

export type ListingModel = {
  id: GameId
  name: string
  nbPlayers: number
  nbSeats: number
  status: GameStatus
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

export class GameListingsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-listings-repository" })
  }

  /**
   * Gets ALL the game listings. This only makes sense until we have real traffic.
   */
  public async getListings(db: PostgresRepository["db"] = this.db): Promise<Result<ListingModel[], string>> {
    const listingsResults = await Result.tryCatch(
      db
        .select({
          id: playersTable.gameId,
          name: gamesTable.name,
          nbPlayers: count(),
          nbSeats: gamesTable.nbSeats,
          createdAt: gamesTable.createdAt,
          startedAt: gamesTable.startedAt,
          endedAt: gamesTable.endedAt,
        })
        .from(playersTable)
        .innerJoin(gamesTable, eq(playersTable.gameId, gamesTable.id))
        .groupBy(playersTable.gameId),
    )
    if (Result.isFailure(listingsResults)) {
      this.logger.error("Failed to get listings", { error: listingsResults.error })
      return Result.Failure(couldNot("get listings"))
    }

    return Result.Success(listingsResults.value.map(toListingModel))
  }
}

function toListingModel(data: Omit<ListingModel, "status">): ListingModel {
  return {
    ...data,
    status: computeGameStatus(data),
  }
}
