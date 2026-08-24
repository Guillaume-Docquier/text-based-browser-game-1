import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { count, eq, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, playersTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

export type ListingModel = {
  id: GameId
  name: string
  hasJoined: boolean
  nbPlayers: number
  nbSeats: number
  status: GameStatus
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

export class ListingsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "listings-repository" })
  }

  /**
   * Gets ALL the game listings. This only makes sense until we have real traffic, at which point we'll need pagination, queries, etc.
   */
  public async getListings(
    { playerId }: { playerId: AccountId | undefined },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<ListingModel[], string>> {
    const listingsResults: Result<ListingModel[], Error> = await Result.tryCatch(
      db
        .select({
          id: gamesTable.id,
          name: gamesTable.name,
          hasJoined:
            playerId === undefined ? sql<boolean>`false` : sql<boolean>`count(*) filter (where ${playersTable.playerId} = ${playerId}) > 0`,
          nbPlayers: count(playersTable.playerId),
          nbSeats: gamesTable.nbSeats,
          createdAt: gamesTable.createdAt,
          startedAt: gamesTable.startedAt,
          endedAt: gamesTable.endedAt,
          status: gamesTable.status,
        })
        .from(gamesTable)
        .leftJoin(playersTable, eq(playersTable.gameId, gamesTable.id))
        .groupBy(gamesTable.id),
    )
    if (Result.isFailure(listingsResults)) {
      this.logger.error("Failed to get listings", { error: listingsResults.error })
      return Result.Failure(couldNot("get listings"))
    }

    return listingsResults
  }
}
