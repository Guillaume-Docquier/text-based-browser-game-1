import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamePlayerResourcesTable } from "#lib/db/schema.ts"
import { and, eq, sql } from "drizzle-orm"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import { type ResourceType } from "#lib/gameResources.ts"

type NewGamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferInsert
type GamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferSelect

export type NewGamePlayerResourceModel = NewGamePlayerResourceRow
export type GamePlayerResourceModel = GamePlayerResourceRow

export type ResourceUpdateModel = {
  gameId: number
  playerId: number
  resourceType: ResourceType
  amountDelta: number
}

export class GamePlayerResourcesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-resources-repository" })
  }

  public async createMany(
    newGamePlayerResources: NewGamePlayerResourceModel[],
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerResourceModel[], string>> {
    if (newGamePlayerResources.length === 0) {
      return Result.Success([])
    }

    const createManyResult = await Result.tryCatch(db.insert(gamePlayerResourcesTable).values(newGamePlayerResources).returning())

    if (Result.isFailure(createManyResult)) {
      this.logger.error("Could not create game player resources", { newGamePlayerResources, error: createManyResult.error })
      return Result.Failure(couldNot("create game player resources"))
    }

    return createManyResult
  }

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
