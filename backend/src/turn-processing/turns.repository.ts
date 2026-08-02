import { Assert, branded, type Branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { ActionType } from "#lib/db/gameplay/actionType.ts"
import type { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { actionsTable, gameStatesTable, gamesTable, playersTable, resourcesTable, turnsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type PlayerRow = typeof playersTable.$inferSelect
type ResourceRow = typeof resourcesTable.$inferSelect
type ActionRow = typeof actionsTable.$inferSelect

/**
 * Owning a TurnForProcessing within a transaction guarantees that the turn and the game are locked, exist and need processing at this time.
 */
export type TurnForProcessing = Branded<
  {
    gameId: GameId
    turn: number
    gameStatus: GameStatus
  },
  "TurnForProcessing"
>

export type StartTurnProcessingModel = {
  turn: TurnForProcessing
  processingStartedAt: Date
  gameStatus: GameStatus
}

/**
 * The full game data for turn processing.
 */
export type TurnToProcessModel = {
  gameId: GameId
  turn: number
  scheduledFor: Date
  turnIntervalSeconds: number
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
      actionType: ActionType | undefined
    }
  >
}

export type ProcessedTurnModel = {
  gameId: GameId
  turn: number
  processedAt: Date
  playerResources: Array<{
    playerId: PlayerId
    resourceType: ResourceType
    amount: number
  }>
  gameStatus: GameStatus
  winnerAccountId?: AccountId
  endedAt?: Date
  nextTurn?: {
    turn: number
    scheduledFor: Date
  }
}

export class TurnsRepository extends PostgresRepository {
  private readonly logger: Logger
  private readonly clock: Clock

  public constructor({ logger, clock, db }: { logger: Logger; clock: Clock; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "turns-repository" })
    this.clock = clock
  }

  /**
   * The next turn to process row will be locked during the transaction.
   */
  public async getNextTurnForProcessing(
    { since }: { since: Date },
    tx: Transaction,
  ): Promise<Result<TurnForProcessing | undefined, string>> {
    const turnToProcessResult = await Result.tryCatch(async () => {
      // Find and lock the turn
      const turnToProcessRows = await tx
        .select({
          gameId: turnsTable.gameId,
          turn: turnsTable.turn,
        })
        .from(turnsTable)
        .where(and(lte(turnsTable.scheduledFor, since), isNull(turnsTable.processingStartedAt)))
        .orderBy(asc(turnsTable.scheduledFor))
        .limit(1)
        .for("no key update", { skipLocked: true })

      const turnToProcess = turnToProcessRows[0]
      if (turnToProcess === undefined) {
        return turnToProcess
      }

      // Lock the game, it is expected to exist
      const gameToProcessRows = await tx
        .select({ status: gamesTable.status })
        .from(gamesTable)
        .where(eq(gamesTable.id, turnToProcess.gameId))
        .for("no key update")
      Assert.isDefined(gameToProcessRows[0])

      return branded<TurnForProcessing>({
        gameId: turnToProcess.gameId,
        turn: turnToProcess.turn,
        gameStatus: gameToProcessRows[0].status,
      })
    })

    if (Result.isFailure(turnToProcessResult)) {
      this.logger.error("Could not get next turn to process", { error: turnToProcessResult.error })
      return Result.Failure(couldNot("get next turn to process"))
    }

    return turnToProcessResult
  }

  /**
   * Moves the game and turn to processing before reading the state used to process the turn.
   */
  public async startTurnProcessing(
    startTurnProcessingModel: StartTurnProcessingModel,
    tx: Transaction,
  ): Promise<Result<TurnToProcessModel, string>> {
    const turnResult = await Result.tryCatch(async () => {
      const turns = await tx
        .update(turnsTable)
        .set({ processingStartedAt: startTurnProcessingModel.processingStartedAt })
        .where(and(eq(turnsTable.gameId, startTurnProcessingModel.turn.gameId), eq(turnsTable.turn, startTurnProcessingModel.turn.turn)))
        .returning({ scheduledFor: turnsTable.scheduledFor })
      Assert.isTrue(turns.length === 1)
      Assert.isDefined(turns[0])

      const games = await tx
        .update(gamesTable)
        .set({ status: startTurnProcessingModel.gameStatus })
        .where(eq(gamesTable.id, startTurnProcessingModel.turn.gameId))
        .returning({ turnIntervalSeconds: gamesTable.turnIntervalSeconds })
      Assert.isTrue(games.length === 1)
      Assert.isDefined(games[0])

      const [players, resources, actions] = await Promise.all([
        tx
          .select()
          .from(playersTable)
          .where(eq(playersTable.gameId, startTurnProcessingModel.turn.gameId))
          .orderBy(asc(playersTable.playerId)),
        tx
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.gameId, startTurnProcessingModel.turn.gameId))
          .orderBy(asc(resourcesTable.playerId), asc(resourcesTable.resourceType)),
        tx
          .select()
          .from(actionsTable)
          .where(
            and(eq(actionsTable.gameId, startTurnProcessingModel.turn.gameId), eq(actionsTable.turn, startTurnProcessingModel.turn.turn)),
          )
          .orderBy(asc(actionsTable.playerId)),
      ])

      return toTurnToProcessModel({
        turnForProcessing: startTurnProcessingModel.turn,
        scheduledFor: turns[0].scheduledFor,
        turnIntervalSeconds: games[0].turnIntervalSeconds,
        players,
        resources,
        actions,
      })
    })

    if (Result.isFailure(turnResult)) {
      this.logger.error("Could not start processing turn", { startTurnProcessingModel, error: turnResult.error })
      return Result.Failure(couldNot("start processing turn"))
    }

    return turnResult
  }

  /**
   * This is fragile and mostly a testing utility for now.
   * It doesn't verify the integrity of other tables.
   */
  public async resetProcessingAttempt(
    turn: { gameId: GameId; turn: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ reset: true }, string>> {
    const turnResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const turns = await tx
          .update(turnsTable)
          .set({ processingStartedAt: null })
          .where(and(eq(turnsTable.gameId, turn.gameId), eq(turnsTable.turn, turn.turn), isNull(turnsTable.processingEndedAt)))
          .returning()
        Assert.isTrue(turns.length === 1)

        const games = await tx
          .update(gamesTable)
          .set({ status: GameStatus.COLLECTING_ACTIONS })
          .where(and(eq(gamesTable.id, turn.gameId), eq(gamesTable.status, GameStatus.PROCESSING_TURN)))
          .returning()
        Assert.isTrue(games.length === 1)
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
          .set({ processingEndedAt: processedTurnModel.processedAt })
          .where(and(eq(turnsTable.gameId, processedTurnModel.gameId), eq(turnsTable.turn, processedTurnModel.turn)))
          .returning()
        Assert.isTrue(updatedTurns.length === 1)

        const updatedGames = await tx
          .update(gamesTable)
          .set({
            status: processedTurnModel.gameStatus,
            winnerAccountId: processedTurnModel.winnerAccountId,
            endedAt: processedTurnModel.endedAt,
          })
          .where(eq(gamesTable.id, processedTurnModel.gameId))
          .returning()
        Assert.isTrue(updatedGames.length === 1)

        // Poor man's batch update using upsert
        // Drizzle doesn't handle this, the alternative is raw SQL... maybe if this is a performance bottleneck
        const resources = processedTurnModel.playerResources.map((resource) => ({ ...resource, gameId: processedTurnModel.gameId }))
        await tx
          .insert(resourcesTable)
          .values(resources)
          .onConflictDoUpdate({
            target: [resourcesTable.gameId, resourcesTable.playerId, resourcesTable.resourceType],
            set: {
              amount: sql`excluded.amount`,
            },
          })

        if (processedTurnModel.nextTurn !== undefined) {
          const insertedTurns = await tx
            .insert(turnsTable)
            .values({
              gameId: processedTurnModel.gameId,
              turn: processedTurnModel.nextTurn.turn,
              scheduledFor: processedTurnModel.nextTurn.scheduledFor,
            })
            .returning()
          Assert.isTrue(insertedTurns.length === 1)

          const updateGameStates = await tx
            .update(gameStatesTable)
            .set({ turn: processedTurnModel.nextTurn.turn, nextTurnAt: processedTurnModel.nextTurn.scheduledFor })
            .where(and(eq(gameStatesTable.gameId, processedTurnModel.gameId), eq(gameStatesTable.turn, processedTurnModel.turn)))
            .returning()
          Assert.isTrue(updateGameStates.length === 1)
        }
      }),
    )

    if (Result.isFailure(saveResult)) {
      this.logger.error("Could not save processed turn", { processedTurn: processedTurnModel, error: saveResult.error })
      return Result.Failure(couldNot("save processed turn"))
    }

    return Result.Success({ saved: true })
  }
}

function toTurnToProcessModel({
  turnForProcessing,
  scheduledFor,
  turnIntervalSeconds,
  players,
  resources,
  actions,
}: {
  turnForProcessing: TurnForProcessing
  scheduledFor: Date
  turnIntervalSeconds: number
  players: PlayerRow[]
  resources: ResourceRow[]
  actions: ActionRow[]
}): TurnToProcessModel {
  const resourcesByPlayerId = Map.groupBy(resources, (resource) => resource.playerId)
  const actionsByPlayerId = Map.groupBy(actions, (action) => action.playerId)

  return {
    ...turnForProcessing,
    scheduledFor,
    turnIntervalSeconds,
    players: players.reduce<TurnToProcessModel["players"]>((playersById, { playerId }) => {
      const resourcesForPlayer = resourcesByPlayerId.get(playerId)
      Assert.isDefined(resourcesForPlayer)

      playersById[playerId] = {
        resources: resourcesForPlayer.map((resource) => ({
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- resourceType uses varchar instead of enum, should probably fix this
          resourceType: resource.resourceType as ResourceType,
          amount: resource.amount,
        })),
        actionType: actionsByPlayerId.get(playerId)?.[0]?.actionType,
      }
      return playersById
    }, {}),
  }
}
