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

type DueTickRow = Pick<typeof ticksTable.$inferSelect, "gameId" | "tick" | "scheduledFor"> & {
  tickIntervalSeconds: (typeof gamesTable.$inferSelect)["tickIntervalSeconds"]
}
type PlayerRow = typeof playersTable.$inferSelect
type ResourceRow = typeof resourcesTable.$inferSelect
type OrderRow = typeof ordersTable.$inferSelect
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTickRow = typeof ticksTable.$inferInsert
type CompletedTickRow = Pick<typeof ticksTable.$inferInsert, "processingStartedAt" | "processingEndedAt">
type EndedGameRow = Pick<typeof gamesTable.$inferInsert, "winnerAccountId" | "endedAt">
type NextGameStateRow = Pick<typeof gameStatesTable.$inferInsert, "tick" | "nextTickAt">

type ProcessedTickRows =
  | {
      result: "continue"
      completedTick: CompletedTickRow
      resources: NewResourceRow[]
      nextGameState: NextGameStateRow
      nextTick: NewTickRow
    }
  | {
      result: "end"
      completedTick: CompletedTickRow
      resources: NewResourceRow[]
      endedGame: EndedGameRow
    }

export type TickToProcessModel = {
  gameId: GameId
  tick: number
  scheduledFor: Date
  tickIntervalSeconds: number
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
      actionType: GamePlayerActionType | undefined
    }
  >
}

export type ProcessedTickModel = {
  gameId: GameId
  tick: number
  processedAt: Date
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
    }
  >
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

  public async getTicksToProcess(db: PostgresRepository["db"] = this.db): Promise<Result<TickToProcessModel[], string>> {
    const ticksToProcessResult = await Result.tryCatch(async () => {
      const ticksToProcessRows = await db
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

      if (ticksToProcessRows.length === 0) {
        return []
      }

      const gameIds = ticksToProcessRows.map(({ gameId }) => gameId)
      const [players, resources, orders] = await Promise.all([
        db
          .select()
          .from(playersTable)
          .where(inArray(playersTable.gameId, gameIds))
          .orderBy(asc(playersTable.gameId), asc(playersTable.playerId)),
        db
          .select()
          .from(resourcesTable)
          .where(inArray(resourcesTable.gameId, gameIds))
          .orderBy(asc(resourcesTable.gameId), asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
        db
          .select()
          .from(ordersTable)
          .where(inArray(ordersTable.gameId, gameIds))
          .orderBy(asc(ordersTable.gameId), asc(ordersTable.playerId), asc(ordersTable.tick)),
      ])

      return ticksToProcessRows.map((tickToProcess) => toTickToProcessModel({ dueTick: tickToProcess, players, resources, orders }))
    })

    if (Result.isFailure(ticksToProcessResult)) {
      this.logger.error("Could not get ticks to process", { error: ticksToProcessResult.error })
      return Result.Failure(couldNot("get ticks to process"))
    }

    return ticksToProcessResult
  }

  public async saveProcessedTick(
    processedTickModel: ProcessedTickModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ saved: true }, string>> {
    const processedTickRows = toProcessedTickRows(processedTickModel)
    const saveResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const completedTicks = await tx
          .update(ticksTable)
          .set(processedTickRows.completedTick)
          .where(
            and(
              eq(ticksTable.gameId, processedTickModel.gameId),
              eq(ticksTable.tick, processedTickModel.tick),
              isNull(ticksTable.processingEndedAt),
            ),
          )
          .returning()

        if (completedTicks.length !== 1) {
          throw new TransactionRollback("Cannot save an already processed or missing tick")
        }

        const currentGameStates = await tx
          .select({ tick: gameStatesTable.tick })
          .from(gameStatesTable)
          .where(and(eq(gameStatesTable.gameId, processedTickModel.gameId), eq(gameStatesTable.tick, processedTickModel.tick)))

        if (currentGameStates.length !== 1) {
          throw new TransactionRollback("Cannot save a stale tick")
        }

        await tx
          .insert(resourcesTable)
          .values(processedTickRows.resources)
          .onConflictDoUpdate({
            target: [resourcesTable.gameId, resourcesTable.playerId, resourcesTable.resourceType],
            set: {
              amount: sql`excluded.amount`,
            },
          })

        switch (processedTickRows.result) {
          case "continue":
            await tx
              .update(gameStatesTable)
              .set(processedTickRows.nextGameState)
              .where(eq(gameStatesTable.gameId, processedTickModel.gameId))
            await tx.insert(ticksTable).values(processedTickRows.nextTick)
            break
          case "end":
            await tx.update(gamesTable).set(processedTickRows.endedGame).where(eq(gamesTable.id, processedTickModel.gameId))
            break
        }
      }),
    )

    if (Result.isFailure(saveResult)) {
      this.logger.error("Could not save processed tick", { processedTick: processedTickModel, error: saveResult.error })
      return Result.Failure(couldNot("save processed tick"))
    }

    return Result.Success({ saved: true })
  }
}

function toTickToProcessModel({
  dueTick,
  players,
  resources,
  orders,
}: {
  dueTick: DueTickRow
  players: PlayerRow[]
  resources: ResourceRow[]
  orders: OrderRow[]
}): TickToProcessModel {
  return {
    ...dueTick,
    players: players
      .filter(({ gameId }) => gameId === dueTick.gameId)
      .reduce<TickToProcessModel["players"]>((playersById, { playerId }) => {
        playersById[playerId] = {
          resources: resources
            .filter((resource) => resource.gameId === dueTick.gameId && resource.playerId === playerId)
            .map(({ resourceType, amount }) => ({
              resourceType: resourceType as ResourceType,
              amount,
            })),
          actionType: orders.find((order) => order.gameId === dueTick.gameId && order.playerId === playerId && order.tick === dueTick.tick)
            ?.actionType,
        }
        return playersById
      }, {}),
  }
}

function toProcessedTickRows(processedTick: ProcessedTickModel): ProcessedTickRows {
  const resources: NewResourceRow[] = Object.entries(processedTick.players).flatMap(([playerId, { resources: playerResources }]) =>
    playerResources.map((resource) => ({
      gameId: processedTick.gameId,
      playerId,
      ...resource,
    })),
  )
  Assert.isTrue(resources.length > 0)

  const completedTick: CompletedTickRow = {
    processingStartedAt: processedTick.processedAt,
    processingEndedAt: processedTick.processedAt,
  }

  if (processedTick.winnerAccountId !== undefined) {
    return {
      result: "end",
      completedTick,
      resources,
      endedGame: {
        winnerAccountId: processedTick.winnerAccountId,
        endedAt: processedTick.processedAt,
      },
    }
  }
  Assert.isDefined(processedTick.nextTick)

  return {
    result: "continue",
    completedTick,
    resources,
    nextGameState: {
      tick: processedTick.nextTick.tick,
      nextTickAt: processedTick.nextTick.scheduledFor,
    },
    nextTick: {
      gameId: processedTick.gameId,
      tick: processedTick.nextTick.tick,
      scheduledFor: processedTick.nextTick.scheduledFor,
    },
  }
}
