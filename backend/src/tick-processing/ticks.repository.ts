import { Assert, branded, type Branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GamePlayerAction } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import type { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import type { MovementTarget } from "#lib/db/gameplay/MovementTarget.ts"
import type { UnitId } from "#lib/db/gameplay/UnitId.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gameStatesTable, gamesTable, ordersTable, playersTable, resourcesTable, ticksTable, unitsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type PlayerRow = typeof playersTable.$inferSelect
type ResourceRow = typeof resourcesTable.$inferSelect
type OrderRow = typeof ordersTable.$inferSelect
type UnitRow = typeof unitsTable.$inferSelect

export type TickUnitModel = {
  readonly id: UnitId
  readonly playerId: PlayerId
  readonly location: MovementTarget
}

/**
 * Owning a TickForProcessing within a transaction guarantees that the tick and the game are locked, exist and need processing at this time.
 */
export type TickForProcessing = Branded<
  {
    gameId: GameId
    tick: number
    gameStatus: GameStatus
  },
  "TickForProcessing"
>

export type StartTickProcessingModel = {
  tick: TickForProcessing
  processingStartedAt: Date
  gameStatus: GameStatus
}

/**
 * The full game data for tick processing.
 */
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
      action: GamePlayerAction | undefined
    }
  >
  units: Record<UnitId, TickUnitModel>
}

export type ProcessedTickModel = {
  gameId: GameId
  tick: number
  processedAt: Date
  playerResources: Array<{
    playerId: PlayerId
    resourceType: ResourceType
    amount: number
  }>
  units: Record<UnitId, TickUnitModel>
  gameStatus: GameStatus
  winnerAccountId?: AccountId
  endedAt?: Date
  nextTick?: {
    tick: number
    scheduledFor: Date
  }
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
  public async getNextTickForProcessing(
    { since }: { since: Date },
    tx: Transaction,
  ): Promise<Result<TickForProcessing | undefined, string>> {
    const tickToProcessResult = await Result.tryCatch(async () => {
      // Find and lock the tick
      const tickToProcessRows = await tx
        .select({
          gameId: ticksTable.gameId,
          tick: ticksTable.tick,
        })
        .from(ticksTable)
        .where(and(lte(ticksTable.scheduledFor, since), isNull(ticksTable.processingStartedAt)))
        .orderBy(asc(ticksTable.scheduledFor))
        .limit(1)
        .for("no key update", { skipLocked: true })

      const tickToProcess = tickToProcessRows[0]
      if (tickToProcess === undefined) {
        return tickToProcess
      }

      // Lock the game, it is expected to exist
      const gameToProcessRows = await tx
        .select({ status: gamesTable.status })
        .from(gamesTable)
        .where(eq(gamesTable.id, tickToProcess.gameId))
        .for("no key update")
      Assert.isDefined(gameToProcessRows[0])

      return branded<TickForProcessing>({
        gameId: tickToProcess.gameId,
        tick: tickToProcess.tick,
        gameStatus: gameToProcessRows[0].status,
      })
    })

    if (Result.isFailure(tickToProcessResult)) {
      this.logger.error("Could not get next tick to process", { error: tickToProcessResult.error })
      return Result.Failure(couldNot("get next tick to process"))
    }

    return tickToProcessResult
  }

  /**
   * Moves the game and tick to processing before reading the state used to process the tick.
   */
  public async startTickProcessing(
    startTickProcessingModel: StartTickProcessingModel,
    tx: Transaction,
  ): Promise<Result<TickToProcessModel, string>> {
    const tickResult = await Result.tryCatch(async () => {
      const ticks = await tx
        .update(ticksTable)
        .set({ processingStartedAt: startTickProcessingModel.processingStartedAt })
        .where(and(eq(ticksTable.gameId, startTickProcessingModel.tick.gameId), eq(ticksTable.tick, startTickProcessingModel.tick.tick)))
        .returning({ scheduledFor: ticksTable.scheduledFor })
      Assert.isTrue(ticks.length === 1)
      Assert.isDefined(ticks[0])

      const games = await tx
        .update(gamesTable)
        .set({ status: startTickProcessingModel.gameStatus })
        .where(eq(gamesTable.id, startTickProcessingModel.tick.gameId))
        .returning({ tickIntervalSeconds: gamesTable.tickIntervalSeconds })
      Assert.isTrue(games.length === 1)
      Assert.isDefined(games[0])

      const [players, resources, orders, units] = await Promise.all([
        tx
          .select()
          .from(playersTable)
          .where(eq(playersTable.gameId, startTickProcessingModel.tick.gameId))
          .orderBy(asc(playersTable.playerId)),
        tx
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.gameId, startTickProcessingModel.tick.gameId))
          .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
        tx
          .select()
          .from(ordersTable)
          .where(
            and(eq(ordersTable.gameId, startTickProcessingModel.tick.gameId), eq(ordersTable.tick, startTickProcessingModel.tick.tick)),
          )
          .orderBy(asc(ordersTable.playerId)),
        tx.select().from(unitsTable).where(eq(unitsTable.gameId, startTickProcessingModel.tick.gameId)).orderBy(asc(unitsTable.id)),
      ])

      return toTickToProcessModel({
        tickForProcessing: startTickProcessingModel.tick,
        scheduledFor: ticks[0].scheduledFor,
        tickIntervalSeconds: games[0].tickIntervalSeconds,
        players,
        resources,
        orders,
        units,
      })
    })

    if (Result.isFailure(tickResult)) {
      this.logger.error("Could not start processing tick", { startTickProcessingModel, error: tickResult.error })
      return Result.Failure(couldNot("start processing tick"))
    }

    return tickResult
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
    const saveResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const updatedTicks = await tx
          .update(ticksTable)
          .set({ processingEndedAt: processedTickModel.processedAt })
          .where(and(eq(ticksTable.gameId, processedTickModel.gameId), eq(ticksTable.tick, processedTickModel.tick)))
          .returning()
        Assert.isTrue(updatedTicks.length === 1)

        const updatedGames = await tx
          .update(gamesTable)
          .set({
            status: processedTickModel.gameStatus,
            winnerAccountId: processedTickModel.winnerAccountId,
            endedAt: processedTickModel.endedAt,
          })
          .where(eq(gamesTable.id, processedTickModel.gameId))
          .returning()
        Assert.isTrue(updatedGames.length === 1)

        // Poor man's batch update using upsert
        // Drizzle doesn't handle this, the alternative is raw SQL... maybe if this is a performance bottleneck
        const resources = processedTickModel.playerResources.map((resource) => ({ ...resource, gameId: processedTickModel.gameId }))
        await tx
          .insert(resourcesTable)
          .values(resources)
          .onConflictDoUpdate({
            target: [resourcesTable.gameId, resourcesTable.playerId, resourcesTable.resourceType],
            set: {
              amount: sql`excluded.amount`,
            },
          })

        const units = Object.values(processedTickModel.units).map((unit) => ({
          id: unit.id,
          gameId: processedTickModel.gameId,
          playerId: unit.playerId,
          ...toLocationColumns(unit.location),
        }))
        if (units.length > 0) {
          await tx.insert(unitsTable).values(units).onConflictDoNothing()
        }

        if (processedTickModel.nextTick !== undefined) {
          const insertedTicks = await tx
            .insert(ticksTable)
            .values({
              gameId: processedTickModel.gameId,
              tick: processedTickModel.nextTick.tick,
              scheduledFor: processedTickModel.nextTick.scheduledFor,
            })
            .returning()
          Assert.isTrue(insertedTicks.length === 1)

          const updateGameStates = await tx
            .update(gameStatesTable)
            .set({ tick: processedTickModel.nextTick.tick, nextTickAt: processedTickModel.nextTick.scheduledFor })
            .where(and(eq(gameStatesTable.gameId, processedTickModel.gameId), eq(gameStatesTable.tick, processedTickModel.tick)))
            .returning()
          Assert.isTrue(updateGameStates.length === 1)
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
  tickForProcessing,
  scheduledFor,
  tickIntervalSeconds,
  players,
  resources,
  orders,
  units,
}: {
  tickForProcessing: TickForProcessing
  scheduledFor: Date
  tickIntervalSeconds: number
  players: PlayerRow[]
  resources: ResourceRow[]
  orders: OrderRow[]
  units: UnitRow[]
}): TickToProcessModel {
  const resourcesByPlayerId = Map.groupBy(resources, (resource) => resource.playerId)
  const ordersByPlayerId = Map.groupBy(orders, (order) => order.playerId)

  return {
    ...tickForProcessing,
    scheduledFor,
    tickIntervalSeconds,
    units: units.reduce<TickToProcessModel["units"]>((unitsById, unitRow) => {
      unitsById[unitRow.id] = toTickUnitModel(unitRow)
      return unitsById
    }, {}),
    players: players.reduce<TickToProcessModel["players"]>((playersById, { playerId }) => {
      const resourcesForPlayer = resourcesByPlayerId.get(playerId)
      Assert.isDefined(resourcesForPlayer)

      playersById[playerId] = {
        resources: resourcesForPlayer.map((resource) => ({
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- resourceType uses varchar instead of enum, should probably fix this
          resourceType: resource.resourceType as ResourceType,
          amount: resource.amount,
        })),
        action: toGamePlayerAction(ordersByPlayerId.get(playerId)?.[0]),
      }
      return playersById
    }, {}),
  }
}

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
function toGamePlayerAction(orderRow: OrderRow | undefined): GamePlayerAction | undefined {
  if (orderRow === undefined) {
    return undefined
  }

  switch (orderRow.actionType) {
    case GamePlayerActionType.MAKE_MORE_MONEY:
    case GamePlayerActionType.WIN_THE_GAME:
      Assert.isTrue(orderRow.destinationSectorId === null && orderRow.destinationBodyId === null)
      return { actionType: orderRow.actionType }
    case GamePlayerActionType.BUILD_UNIT:
      return {
        actionType: orderRow.actionType,
        destination: toMovementTarget({ sectorId: orderRow.destinationSectorId, bodyId: orderRow.destinationBodyId }),
      }
    default:
      Assert.isExhausted(orderRow.actionType)
      return orderRow.actionType
  }
}

function toTickUnitModel(unitRow: UnitRow): TickUnitModel {
  return {
    id: unitRow.id,
    playerId: unitRow.playerId,
    location: toMovementTarget(unitRow),
  }
}

function toMovementTarget({ sectorId, bodyId }: { sectorId: string | null; bodyId: string | null }): MovementTarget {
  if (sectorId !== null) {
    Assert.isTrue(bodyId === null)
    return { targetType: "SECTOR", sectorId }
  }

  Assert.isDefined(bodyId)
  return { targetType: "BODY", bodyId }
}

function toLocationColumns(location: MovementTarget): { sectorId: string | null; bodyId: string | null } {
  return location.targetType === "SECTOR" ? { sectorId: location.sectorId, bodyId: null } : { sectorId: null, bodyId: location.bodyId }
}
