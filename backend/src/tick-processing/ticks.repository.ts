import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import type { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
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
  private readonly clock: Clock

  public constructor({ logger, clock, db }: { logger: Logger; clock: Clock; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "ticks-repository" })
    this.clock = clock
  }

  /**
   * The next tick to process row will be locked during the transaction.
   */
  public async getNextTickToProcess(
    { since }: { since: Date },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<TickToProcessModel | undefined, string>> {
    const tickToProcessResult = await Result.tryCatch(async () => {
      const tickToProcessRows = await db
        .select({
          gameId: ticksTable.gameId,
          tick: ticksTable.tick,
          scheduledFor: ticksTable.scheduledFor,
          tickIntervalSeconds: gamesTable.tickIntervalSeconds,
        })
        .from(ticksTable)
        .innerJoin(gamesTable, eq(gamesTable.id, ticksTable.gameId))
        .innerJoin(gameStatesTable, and(eq(gameStatesTable.gameId, ticksTable.gameId), eq(gameStatesTable.tick, ticksTable.tick)))
        .where(
          and(
            lte(ticksTable.scheduledFor, since),
            isNull(ticksTable.processingStartedAt),
            eq(gamesTable.status, GameStatus.COLLECTING_ORDERS),
          ),
        )
        .orderBy(asc(ticksTable.scheduledFor))
        .limit(1)
        .for("no key update", { skipLocked: true })

      const tickToProcessRow = tickToProcessRows[0]
      if (tickToProcessRow === undefined) {
        return undefined
      }

      const [players, resources, orders] = await Promise.all([
        db.select().from(playersTable).where(eq(playersTable.gameId, tickToProcessRow.gameId)).orderBy(asc(playersTable.playerId)),
        db
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.gameId, tickToProcessRow.gameId))
          .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
        db
          .select()
          .from(ordersTable)
          .where(and(eq(ordersTable.gameId, tickToProcessRow.gameId), eq(ordersTable.tick, tickToProcessRow.tick)))
          .orderBy(asc(ordersTable.playerId)),
      ])

      return toTickToProcessModel({ dueTick: tickToProcessRow, players, resources, orders })
    })

    if (Result.isFailure(tickToProcessResult)) {
      this.logger.error("Could not get next tick to process", { error: tickToProcessResult.error })
      return Result.Failure(couldNot("get next tick to process"))
    }

    return tickToProcessResult
  }

  /**
   * Trying to start processing a tick that doesn't exist or that is already processing will result in an Failure.
   */
  public async startProcessingTick(
    tick: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ started: true }, string>> {
    const tickResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx
          .update(gamesTable)
          .set({ status: GameStatus.PROCESSING_TICK })
          .where(and(eq(gamesTable.id, tick.gameId), eq(gamesTable.status, GameStatus.COLLECTING_ORDERS)))
          .returning()

        if (games.length !== 1) {
          throw new TransactionRollback("Cannot start processing tick in the current game status")
        }

        const ticks = await tx
          .update(ticksTable)
          .set({ processingStartedAt: this.clock.now() })
          .where(and(eq(ticksTable.gameId, tick.gameId), eq(ticksTable.tick, tick.tick), isNull(ticksTable.processingStartedAt)))
          .returning()

        Assert.isTrue(ticks.length <= 1)
        if (ticks.length === 0) {
          throw new TransactionRollback("Cannot start a missing or already processing tick")
        }
      }),
    )
    if (Result.isFailure(tickResult)) {
      this.logger.error("Could not start processing tick", { tick, error: tickResult.error })
      return Result.Failure(couldNot("start processing tick"))
    }

    return Result.Success({ started: true })
  }
  /**
   * This is fragile and mostly a testing utility for now.
   * It doesn't verify the integrity of other tables.
   */
  public async resetProcessingAttempt(
    tick: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ reset: true }, string>> {
    const tickResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const ticks = await tx
          .update(ticksTable)
          .set({ processingStartedAt: null })
          .where(and(eq(ticksTable.gameId, tick.gameId), eq(ticksTable.tick, tick.tick), isNull(ticksTable.processingEndedAt)))
          .returning()
        Assert.isTrue(ticks.length === 1)

        const games = await tx
          .update(gamesTable)
          .set({ status: GameStatus.COLLECTING_ORDERS })
          .where(and(eq(gamesTable.id, tick.gameId), eq(gamesTable.status, GameStatus.PROCESSING_TICK)))
          .returning()
        Assert.isTrue(games.length === 1)
      }),
    )
    if (Result.isFailure(tickResult)) {
      this.logger.error("Could not reset tick processing", { tick, error: tickResult.error })
      return Result.Failure(couldNot("reset tick processing"))
    }

    return Result.Success({ reset: true })
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
            await transitionProcessingGame({ gameId: processedTickModel.gameId, status: GameStatus.COLLECTING_ORDERS }, tx)
            break
          case "end":
            await transitionProcessingGame(
              { gameId: processedTickModel.gameId, status: GameStatus.ENDED, endedGame: processedTickRows.endedGame },
              tx,
            )
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

async function transitionProcessingGame(
  {
    gameId,
    status,
    endedGame,
  }: {
    gameId: GameId
    status: typeof GameStatus.COLLECTING_ORDERS | typeof GameStatus.ENDED
    endedGame?: EndedGameRow
  },
  db: PostgresRepository["db"],
): Promise<void> {
  const games = await db
    .update(gamesTable)
    .set({ ...endedGame, status })
    .where(and(eq(gamesTable.id, gameId), eq(gamesTable.status, GameStatus.PROCESSING_TICK)))
    .returning()

  if (games.length !== 1) {
    throw new TransactionRollback("Cannot transition processed tick in the current game status")
  }
}
