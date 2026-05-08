import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerResourcesTable } from "./schema.ts"
import { and, eq, sql } from "drizzle-orm"
import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import { type ResourceType } from "#lib/gameResources.ts"

export class GamePlayerResourcesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-resources-repository" })
  }

  public async updateResource(
    params: {
      gameId: number
      playerId: number
      resourceType: ResourceType
      amountDelta: number
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResourceResult = await Result.tryCatch(async (): Promise<true> => {
      await db
        .update(gamePlayerResourcesTable)
        .set({ amount: sql`${gamePlayerResourcesTable.amount} + ${params.amountDelta}` })
        .where(
          and(
            eq(gamePlayerResourcesTable.gameId, params.gameId),
            eq(gamePlayerResourcesTable.playerId, params.playerId),
            eq(gamePlayerResourcesTable.resourceType, params.resourceType),
          ),
        )

      return true
    })

    if (Result.isFailure(updateResourceResult)) {
      this.logger.error("Could not update resource for game and player", { ...params, error: updateResourceResult.error })
      return Result.Failure(couldNot("update resource for game and player"))
    }

    return updateResourceResult
  }
}
