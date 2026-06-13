import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { type ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamePlayerResourcesTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type NewGamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferInsert
type GamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferSelect

export type NewGamePlayerResourceModel = NewGamePlayerResourceRow
export type GamePlayerResourceModel = GamePlayerResourceRow

export type ResourceUpdateModel = {
  gameId: GameId
  playerId: PlayerId
  resourceType: ResourceType
  amountDelta: number
}

/**
 * @deprecated To be replaced by better repositories
 */
export class GamePlayerResourcesRepository extends PostgresRepository {
  private readonly logger: Logger

  /**
   * @deprecated To be replaced by better repositories
   */
  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-resources-repository" })
  }

  /**
   * @deprecated To be replaced by better repositories
   */
  public async updateResource(resourceUpdate: ResourceUpdateModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const updateResourceResult = await Result.tryCatch(async (): Promise<true> => {
      await db
        .update(gamePlayerResourcesTable)
        .set({ amount: sql`${gamePlayerResourcesTable.amount} + ${resourceUpdate.amountDelta}` })
        .where(
          and(
            eq(gamePlayerResourcesTable.gameId, resourceUpdate.gameId),
            eq(gamePlayerResourcesTable.playerId, resourceUpdate.playerId),
            eq(gamePlayerResourcesTable.resourceType, resourceUpdate.resourceType),
          ),
        )

      return true
    })

    if (Result.isFailure(updateResourceResult)) {
      this.logger.error("Could not update resource for game and player", { ...resourceUpdate, error: updateResourceResult.error })
      return Result.Failure(couldNot("update resource for game and player"))
    }

    return updateResourceResult
  }
}
