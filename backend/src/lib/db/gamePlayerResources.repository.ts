import { PostgresRepository } from "./PostgresRepository.ts"
import { gamePlayerResourcesTable } from "./schema.ts"
import { and, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { ResourceType } from "#lib/gameResources.ts"

export type GamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferSelect
export type GamePlayerResourceRowInsert = typeof gamePlayerResourcesTable.$inferInsert

export class GamePlayerResourcesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-player-resources-repository" })
  }

  public async createMany(newResources: GamePlayerResourceRowInsert[]): Promise<Result<GamePlayerResourceRow[], string>> {
    const createResult = await Result.tryCatch(async () => {
      const resources = await this.db.insert(gamePlayerResourcesTable).values(newResources).returning()
      Assert.isTrue(resources.length === newResources.length)

      return resources
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game player resources", { newResources, error: createResult.error })
      return Result.Failure(couldNot("create game player resources"))
    }

    return createResult
  }

  public async getByGameAndPlayer({
    gameId,
    playerId,
  }: {
    gameId: number
    playerId: number
  }): Promise<Result<GamePlayerResourceRow[], string>> {
    const getResourcesResult = await Result.tryCatch(
      async () =>
        await this.db
          .select()
          .from(gamePlayerResourcesTable)
          .where(and(eq(gamePlayerResourcesTable.gameId, gameId), eq(gamePlayerResourcesTable.playerId, playerId))),
    )

    if (Result.isFailure(getResourcesResult)) {
      this.logger.error("Could not get game player resources", { gameId, playerId, error: getResourcesResult.error })
      return Result.Failure(couldNot("get game player resources"))
    }

    return getResourcesResult
  }

  public async updateAmount({
    gameId,
    playerId,
    resourceType,
    amount,
  }: {
    gameId: number
    playerId: number
    resourceType: ResourceType
    amount: number
  }): Promise<Result<true, string>> {
    const updateAmountResult = await Result.tryCatch(async (): Promise<true> => {
      await this.db
        .update(gamePlayerResourcesTable)
        .set({ amount })
        .where(
          and(
            eq(gamePlayerResourcesTable.gameId, gameId),
            eq(gamePlayerResourcesTable.playerId, playerId),
            eq(gamePlayerResourcesTable.resourceType, resourceType),
          ),
        )

      return true
    })

    if (Result.isFailure(updateAmountResult)) {
      this.logger.error("Could not update game player resource", {
        gameId,
        playerId,
        resourceType,
        amount,
        error: updateAmountResult.error,
      })
      return Result.Failure(couldNot("update game player resource"))
    }

    return updateAmountResult
  }
}
