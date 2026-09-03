import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { resourcesTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import type { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

export type ResourceUpdateModel = {
  gameId: GameId
  playerId: PlayerId
  resourceType: ResourceType
  amountDelta: number
}

/**
 * A repository just to facilitate tests, as manipulating resources can be tedious otherwise.
 */
export class ResourcesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-resources-repository" })
  }

  public async updateResource(resourceUpdate: ResourceUpdateModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const updateResourceResult = await Result.tryCatch(async (): Promise<true> => {
      await db
        .update(resourcesTable)
        .set({ amount: sql`${resourcesTable.amount} + ${resourceUpdate.amountDelta}` })
        .where(
          and(
            eq(resourcesTable.gameId, resourceUpdate.gameId),
            eq(resourcesTable.playerId, resourceUpdate.playerId),
            eq(resourcesTable.resourceType, resourceUpdate.resourceType),
          ),
        )

      return true
    })

    return Result.map(updateResourceResult, {
      failure: (error) => {
        this.logger.error("Could not update resource for game and player", { ...resourceUpdate, error })
        return couldNot("update resource for game and player")
      },
    })
  }
}
