import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import type { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gameStatesTable, gamesTable, ordersTable, playersTable, resourcesTable, ticksTable } from "#lib/db/schema.ts"
import { couldNot, TransactionRollback } from "#lib/errors.ts"

export type TickToProcessModel = {
  gameId: GameId
  tick: number
  scheduledFor: Date
  tickIntervalSeconds: number
  players: Array<{
    playerId: PlayerId
    resources: Array<{
      resourceType: ResourceType
      amount: number
    }>
    actionType: GamePlayerActionType | undefined
  }>
}

export type ProcessedTickModel = {
  gameId: GameId
  tick: number
  processedAt: Date
  players: Array<{
    playerId: PlayerId
    resources: Array<{
      resourceType: ResourceType
      amount: number
    }>
  }>
  winnerAccountId: AccountId | undefined
  nextTick:
    | {
        tick: number
        scheduledFor: Date
      }
    | undefined
}

export class TicksRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "ticks-repository" })
  }

  public async getTicksToProcess(): Promise<Result<TickToProcessModel[], string>> {
    const ticksToProcessResult = await Result.tryCatch(async () => {
      const dueTicks = await this.db
        .select({
          gameId: ticksTable.gameId,
          tick: ticksTable.tick,
          scheduledFor: ticksTable.scheduledFor,
          tickIntervalSeconds: gamesTable.tickIntervalSeconds,
        })
        .from(ticksTable)
        .innerJoin(gamesTable, eq(gamesTable.id, ticksTable.gameId))
        .innerJoin(gameStatesTable, and(eq(gameStatesTable.gameId, ticksTable.gameId), eq(gameStatesTable.tick, ticksTable.tick)))
        .where(and(isNull(ticksTable.processingEndedAt), isNull(gamesTable.endedAt), lte(ticksTable.scheduledFor, new Date())))
        .orderBy(asc(ticksTable.scheduledFor), asc(ticksTable.gameId), asc(ticksTable.tick))

      if (dueTicks.length === 0) {
        return []
      }

      const gameIds = dueTicks.map(({ gameId }) => gameId)
      const [players, resources, orders] = await Promise.all([
        this.db
          .select()
          .from(playersTable)
          .where(inArray(playersTable.gameId, gameIds))
          .orderBy(asc(playersTable.gameId), asc(playersTable.playerId)),
        this.db
          .select()
          .from(resourcesTable)
          .where(inArray(resourcesTable.gameId, gameIds))
          .orderBy(asc(resourcesTable.gameId), asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
        this.db
          .select()
          .from(ordersTable)
          .where(inArray(ordersTable.gameId, gameIds))
          .orderBy(asc(ordersTable.gameId), asc(ordersTable.playerId), asc(ordersTable.tick)),
      ])

      return dueTicks.map(
        (dueTick): TickToProcessModel => ({
          ...dueTick,
          players: players
            .filter(({ gameId }) => gameId === dueTick.gameId)
            .map(({ playerId }) => ({
              playerId,
              resources: resources
                .filter((resource) => resource.gameId === dueTick.gameId && resource.playerId === playerId)
                .map(({ resourceType, amount }) => ({
                  resourceType: resourceType as ResourceType,
                  amount,
                })),
              actionType: orders.find(
                (order) => order.gameId === dueTick.gameId && order.playerId === playerId && order.tick === dueTick.tick,
              )?.actionType,
            })),
        }),
      )
    })

    if (Result.isFailure(ticksToProcessResult)) {
      this.logger.error("Could not get ticks to process", { error: ticksToProcessResult.error })
      return Result.Failure(couldNot("get ticks to process"))
    }

    return ticksToProcessResult
  }

  public async saveProcessedTick(processedTick: ProcessedTickModel): Promise<Result<true, string>> {
    const saveResult = await Result.tryCatch(
      this.db.transaction(async (tx): Promise<true> => {
        const completedTicks = await tx
          .update(ticksTable)
          .set({
            processingStartedAt: processedTick.processedAt,
            processingEndedAt: processedTick.processedAt,
          })
          .where(
            and(eq(ticksTable.gameId, processedTick.gameId), eq(ticksTable.tick, processedTick.tick), isNull(ticksTable.processingEndedAt)),
          )
          .returning()

        if (completedTicks.length !== 1) {
          throw new TransactionRollback("Cannot save an already processed or missing tick")
        }

        const currentGameStates = await tx
          .select({ tick: gameStatesTable.tick })
          .from(gameStatesTable)
          .where(and(eq(gameStatesTable.gameId, processedTick.gameId), eq(gameStatesTable.tick, processedTick.tick)))

        if (currentGameStates.length !== 1) {
          throw new TransactionRollback("Cannot save a stale tick")
        }

        const resources = processedTick.players.flatMap(({ playerId, resources: playerResources }) =>
          playerResources.map((resource) => ({
            gameId: processedTick.gameId,
            playerId,
            ...resource,
          })),
        )
        Assert.isTrue(resources.length > 0)

        await tx
          .insert(resourcesTable)
          .values(resources)
          .onConflictDoUpdate({
            target: [resourcesTable.gameId, resourcesTable.playerId, resourcesTable.resourceType],
            set: {
              amount: sql`excluded.amount`,
            },
          })

        if (processedTick.winnerAccountId !== undefined) {
          await tx
            .update(gamesTable)
            .set({
              winnerAccountId: processedTick.winnerAccountId,
              endedAt: processedTick.processedAt,
            })
            .where(eq(gamesTable.id, processedTick.gameId))
        } else {
          Assert.isDefined(processedTick.nextTick)

          await tx
            .update(gameStatesTable)
            .set({
              tick: processedTick.nextTick.tick,
              nextTickAt: processedTick.nextTick.scheduledFor,
            })
            .where(eq(gameStatesTable.gameId, processedTick.gameId))

          await tx.insert(ticksTable).values({
            gameId: processedTick.gameId,
            tick: processedTick.nextTick.tick,
            scheduledFor: processedTick.nextTick.scheduledFor,
          })
        }

        return true
      }),
    )

    if (Result.isFailure(saveResult)) {
      this.logger.error("Could not save processed tick", { processedTick, error: saveResult.error })
      return Result.Failure(couldNot("save processed tick"))
    }

    return saveResult
  }
}
