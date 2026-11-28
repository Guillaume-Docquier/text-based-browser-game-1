import { Assert, branded, type Branded, type Logger, Result, type RngState, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { TurnResolution } from "shared/turn-resolution/resolveTurn.ts"
import type { TurnState } from "shared/turn-resolution/TurnState.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  buildingsTable,
  constructionOrdersTable,
  gamesTable,
  planetsTable,
  playersTable,
  turnsProcessingTable,
  turnsTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

export type TurnForProcessing = Branded<
  "TurnForProcessing",
  {
    gameId: GameId
    turn: number
  }
>

export type StartTurnProcessingModel = {
  turn: TurnForProcessing
  processingStartedAt: Date
}

export type TurnToProcessModel = TurnState & {
  readonly closedAt: Date
  readonly turnInterval: Time
  readonly rngState: RngState<number>
}

export type ProcessedTurnModel = TurnResolution & {
  gameId: GameId
  turn: number
  processedAt: Date
  rngState: RngState<number>
  nextTurn: number
  nextTurnScheduledFor: Date
}

export class TurnsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "turns-repository" })
  }

  public async moveDueTurnsToAwaitingProcessing({ since }: { since: Date }, db: PostgresRepository["db"] = this.db): Promise<void> {
    await db
      .update(turnsTable)
      .set({ status: TurnStatus.AWAITING_PROCESSING, closedAt: turnsTable.endsAt })
      .where(and(eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS), lte(turnsTable.endsAt, since)))
  }

  public async getNextTurnForProcessing({ since }: { since: Date }, tx: Transaction): Promise<TurnForProcessing | undefined> {
    const turnToProcessRows = await tx
      .select({
        gameId: turnsProcessingTable.gameId,
        turn: turnsProcessingTable.turn,
      })
      .from(turnsProcessingTable)
      .where(and(lte(turnsProcessingTable.scheduledFor, since), isNull(turnsProcessingTable.processingStartedAt)))
      .orderBy(asc(turnsProcessingTable.scheduledFor))
      .limit(1)
      .for("no key update", { skipLocked: true })

    const turnToProcess = turnToProcessRows[0]
    if (turnToProcess === undefined) {
      return turnToProcess
    }

    return branded(turnToProcess)
  }

  public async startTurnProcessing(startTurnProcessingModel: StartTurnProcessingModel, tx: Transaction): Promise<TurnToProcessModel> {
    const turns = await tx
      .update(turnsTable)
      .set({ status: TurnStatus.PROCESSING })
      .where(
        and(
          eq(turnsTable.gameId, startTurnProcessingModel.turn.gameId),
          eq(turnsTable.turn, startTurnProcessingModel.turn.turn),
          eq(turnsTable.status, TurnStatus.AWAITING_PROCESSING),
        ),
      )
      .returning({
        rngGeneratorState: turnsTable.rngGeneratorState,
        rngSpareNormal: turnsTable.rngSpareNormal,
        closedAt: turnsTable.closedAt,
        endsAt: turnsTable.endsAt,
      })
    Assert.isTrue(turns.length === 1)
    const turn = turns[0]
    Assert.isDefined(turn)
    Assert.isDefined(turn.closedAt)

    const processingRows = await tx
      .update(turnsProcessingTable)
      .set({ processingStartedAt: startTurnProcessingModel.processingStartedAt })
      .where(
        and(
          eq(turnsProcessingTable.gameId, startTurnProcessingModel.turn.gameId),
          eq(turnsProcessingTable.turn, startTurnProcessingModel.turn.turn),
          isNull(turnsProcessingTable.processingStartedAt),
        ),
      )
      .returning({ scheduledFor: turnsProcessingTable.scheduledFor })
    Assert.isTrue(processingRows.length === 1)
    Assert.isDefined(processingRows[0])

    const games = await tx
      .select({ turnIntervalSeconds: gamesTable.turnIntervalSeconds })
      .from(gamesTable)
      .where(eq(gamesTable.id, startTurnProcessingModel.turn.gameId))
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    const players = await tx
      .select({ id: playersTable.playerId })
      .from(playersTable)
      .where(eq(playersTable.gameId, startTurnProcessingModel.turn.gameId))
      .orderBy(asc(playersTable.playerId))
    const planets = await tx
      .select({
        id: planetsTable.id,
        name: planetsTable.name,
        ownerPlayerId: planetsTable.ownerPlayerId,
        x: planetsTable.x,
        y: planetsTable.y,
      })
      .from(planetsTable)
      .where(eq(planetsTable.gameId, startTurnProcessingModel.turn.gameId))
      .orderBy(asc(planetsTable.id))

    const buildings = await tx
      .select({ type: buildingsTable.type, planetId: buildingsTable.planetId })
      .from(buildingsTable)
      .where(eq(buildingsTable.gameId, startTurnProcessingModel.turn.gameId))
      .orderBy(asc(buildingsTable.id))

    const constructionOrders = await tx
      .select({
        planetId: constructionOrdersTable.planetId,
        playerId: constructionOrdersTable.playerId,
        type: constructionOrdersTable.type,
        site: constructionOrdersTable.site,
        cost: constructionOrdersTable.cost,
      })
      .from(constructionOrdersTable)
      .where(
        and(
          eq(constructionOrdersTable.gameId, startTurnProcessingModel.turn.gameId),
          eq(constructionOrdersTable.turn, startTurnProcessingModel.turn.turn),
        ),
      )
      .orderBy(asc(constructionOrdersTable.id))

    return {
      ...startTurnProcessingModel.turn,
      constructionOrders,
      buildings,
      closedAt: turn.closedAt,
      turnInterval: Time.create(games[0].turnIntervalSeconds, UnitOfTime.SECONDS),
      rngState: {
        generatorState: turn.rngGeneratorState,
        spareNormal: turn.rngSpareNormal,
      },
      players,
      planets,
    }
  }

  public async resetProcessingAttempt(
    turn: { gameId: GameId; turn: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ reset: true }, string>> {
    const turnResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const processingRows = await tx
          .update(turnsProcessingTable)
          .set({ processingStartedAt: null })
          .where(
            and(
              eq(turnsProcessingTable.gameId, turn.gameId),
              eq(turnsProcessingTable.turn, turn.turn),
              isNull(turnsProcessingTable.processingEndedAt),
            ),
          )
          .returning()
        Assert.isTrue(processingRows.length === 1)

        const turns = await tx
          .update(turnsTable)
          .set({ status: TurnStatus.AWAITING_PROCESSING })
          .where(and(eq(turnsTable.gameId, turn.gameId), eq(turnsTable.turn, turn.turn), eq(turnsTable.status, TurnStatus.PROCESSING)))
          .returning()
        Assert.isTrue(turns.length === 1)
      }),
    )
    if (Result.isFailure(turnResult)) {
      this.logger.error("Could not reset turn processing", { turn, error: turnResult.error })
      return Result.Failure(couldNot("reset turn processing"))
    }

    return Result.Success({ reset: true })
  }

  public async saveProcessedTurn(
    processedTurnModel: ProcessedTurnModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ saved: true }, string>> {
    const saveResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const updatedTurns = await tx
          .update(turnsTable)
          .set({ status: TurnStatus.COMPLETED })
          .where(
            and(
              eq(turnsTable.gameId, processedTurnModel.gameId),
              eq(turnsTable.turn, processedTurnModel.turn),
              eq(turnsTable.status, TurnStatus.PROCESSING),
            ),
          )
          .returning()
        Assert.isTrue(updatedTurns.length === 1)

        const updatedProcessingRows = await tx
          .update(turnsProcessingTable)
          .set({ processingEndedAt: processedTurnModel.processedAt })
          .where(
            and(
              eq(turnsProcessingTable.gameId, processedTurnModel.gameId),
              eq(turnsProcessingTable.turn, processedTurnModel.turn),
              isNull(turnsProcessingTable.processingEndedAt),
            ),
          )
          .returning()
        Assert.isTrue(updatedProcessingRows.length === 1)

        if (processedTurnModel.buildingsToPlace.length > 0) {
          await tx
            .insert(buildingsTable)
            .values(processedTurnModel.buildingsToPlace.map((building) => ({ ...building, gameId: processedTurnModel.gameId })))
          await tx
            .delete(constructionOrdersTable)
            .where(
              and(eq(constructionOrdersTable.gameId, processedTurnModel.gameId), eq(constructionOrdersTable.turn, processedTurnModel.turn)),
            )
        }
        for (const [playerId, creditChange] of processedTurnModel.creditChanges) {
          await tx
            .update(playersTable)
            .set({ creditBalance: sql`${playersTable.creditBalance} + ${creditChange}` })
            .where(and(eq(playersTable.gameId, processedTurnModel.gameId), eq(playersTable.playerId, playerId)))
        }

        await tx.update(playersTable).set({ isReady: false }).where(eq(playersTable.gameId, processedTurnModel.gameId))

        const insertedTurns = await tx
          .insert(turnsTable)
          .values({
            gameId: processedTurnModel.gameId,
            turn: processedTurnModel.nextTurn,
            status: TurnStatus.COLLECTING_ACTIONS,
            startedAt: processedTurnModel.processedAt,
            endsAt: processedTurnModel.nextTurnScheduledFor,
            rngGeneratorState: processedTurnModel.rngState.generatorState,
            rngSpareNormal: processedTurnModel.rngState.spareNormal,
          })
          .returning()
        Assert.isTrue(insertedTurns.length === 1)

        await tx.insert(turnsProcessingTable).values({
          gameId: processedTurnModel.gameId,
          turn: processedTurnModel.nextTurn,
          scheduledFor: processedTurnModel.nextTurnScheduledFor,
        })
      }),
    )

    if (Result.isFailure(saveResult)) {
      this.logger.error("Could not save processed turn", { processedTurn: processedTurnModel, error: saveResult.error })
      return Result.Failure(couldNot("save processed turn"))
    }

    return Result.Success({ saved: true })
  }
}
