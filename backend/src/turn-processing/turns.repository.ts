import { Assert, branded, type Branded, type Logger, Result, type RngState, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { actionsTable, gamesTable, playersTable, resourcesTable, rulesetsTable, turnsProcessingTable, turnsTable } from "#lib/db/schema.ts"
import { TurnStatus } from "#lib/db/turns/TurnStatus.ts"
import { couldNot } from "#lib/errors.ts"
import type { AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import type { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

type PlayerRow = typeof playersTable.$inferSelect
type ResourceRow = typeof resourcesTable.$inferSelect
type SubmittedActionRow = typeof actionsTable.$inferSelect

/**
 * Owning a TurnForProcessing within a transaction guarantees that the turn and its processing row are locked and need processing.
 */
export type TurnForProcessing = Branded<
  {
    gameId: GameId
    turn: number
  },
  "TurnForProcessing"
>

export type StartTurnProcessingModel = {
  /**
   * The TurnForProcessing must be acquired in the same transaction.
   */
  turn: TurnForProcessing
  processingStartedAt: Date
}

/**
 * The full game data for turn processing.
 */
export type TurnToProcessModel = {
  readonly gameId: GameId
  readonly turn: number
  readonly scheduledFor: Date
  readonly turnInterval: Time
  readonly rngState: RngState<number>
  readonly submittedActions: SubmittedAction[]
  readonly players: Record<
    PlayerId,
    {
      id: PlayerId
      resources: Resources
    }
  >
  readonly ruleset: Ruleset
}

export type ProcessedTurnModel = {
  gameId: GameId
  turn: number
  processedAt: Date
  rngState: RngState<number>
  playerResources: Array<{
    playerId: PlayerId
    resourceType: ResourceType
    amount: number
  }>
  winnerAccountId?: AccountId
  nextTurn: number
  availableActions: AvailableAction[]
  /**
   * Not defined when endedAt is set
   */
  nextTurnScheduledFor?: Date
  /**
   * Not defined when nextTurnScheduledFor is set
   */
  endedAt?: Date
}

export class TurnsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "turns-repository" })
  }

  /**
   * Moves all due turns to AWAITING_PROCESSING.
   */
  public async markDueTurnsAwaitingProcessing({ since }: { since: Date }, db: PostgresRepository["db"] = this.db): Promise<void> {
    // We can't do .for("no key update", { skipLocked: true }) on an update statement
    // This will wait until all rows are unlocked
    // It shouldn't happen a lot, and it should resolve really quickly
    // But it's still a risk vector for... eventually
    await db
      .update(turnsTable)
      .set({ status: TurnStatus.AWAITING_PROCESSING })
      .where(and(eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS), lte(turnsTable.endsAt, since)))
  }

  /**
   * The next turn to process row will be locked during the transaction.
   */
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

  /**
   * Moves the turn and processing row to processing before reading the state used to process the turn.
   */
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
      })
    Assert.isTrue(turns.length === 1)
    Assert.isDefined(turns[0])

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
      .select({ turnIntervalSeconds: gamesTable.turnIntervalSeconds, rulesetId: gamesTable.rulesetId })
      .from(gamesTable)
      .where(eq(gamesTable.id, startTurnProcessingModel.turn.gameId))
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    const [players, resources, submittedActions, rulesets] = await Promise.all([
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
      tx.select().from(rulesetsTable).where(eq(rulesetsTable.id, games[0].rulesetId)),
    ])

    Assert.isTrue(rulesets.length === 1)
    Assert.isDefined(rulesets[0])

    const ruleset = RulesetsRepository.toRuleset(rulesets[0])

    return toTurnToProcessModel({
      turnForProcessing: startTurnProcessingModel.turn,
      scheduledFor: processingRows[0].scheduledFor,
      turnInterval: Time.create(games[0].turnIntervalSeconds, UnitOfTime.SECONDS),
      rngState: {
        generatorState: turns[0].rngGeneratorState,
        spareNormal: turns[0].rngSpareNormal,
      },
      players,
      resources,
      submittedActions,
      ruleset,
    })
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
          .set({ status: TurnStatus.COMPLETED, completedAt: processedTurnModel.processedAt })
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

        if (processedTurnModel.nextTurnScheduledFor === undefined) {
          Assert.isDefined(processedTurnModel.endedAt)
          const updatedGames = await tx
            .update(gamesTable)
            .set({
              status: GameStatus.ENDED,
              winnerAccountId: processedTurnModel.winnerAccountId,
              endedAt: processedTurnModel.endedAt,
            })
            .where(eq(gamesTable.id, processedTurnModel.gameId))
            .returning()
          Assert.isTrue(updatedGames.length === 1)
          return
        }

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

        const availableActions = processedTurnModel.availableActions.map((availableAction) => ({
          ...availableAction,
          gameId: processedTurnModel.gameId,
          turn: processedTurnModel.nextTurn,
          targets: null,
        }))
        if (availableActions.length > 0) {
          await tx.insert(actionsTable).values(availableActions)
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
  turnInterval,
  rngState,
  players,
  resources,
  submittedActions,
  ruleset,
}: {
  turnForProcessing: TurnForProcessing
  scheduledFor: Date
  turnInterval: Time
  rngState: RngState<number>
  players: PlayerRow[]
  resources: ResourceRow[]
  submittedActions: SubmittedActionRow[]
  ruleset: Ruleset
}): TurnToProcessModel {
  const resourcesByPlayerId = Map.groupBy(resources, (resource) => resource.playerId)

  return {
    ...turnForProcessing,
    scheduledFor,
    turnInterval,
    rngState,
    submittedActions: submittedActions.flatMap(({ id, playerId, actionDefinitionId, targets }) =>
      targets === null ? [] : [{ id, playerId, actionDefinitionId, targets }],
    ),
    players: players.reduce<TurnToProcessModel["players"]>((playersById, { playerId }) => {
      const resourcesForPlayer = resourcesByPlayerId.get(playerId)
      Assert.isDefined(resourcesForPlayer)

      playersById[playerId] = {
        id: playerId,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Resource types are persisted as text instead of enum, should probably fix this
        resources: Object.fromEntries(resourcesForPlayer.map((resource) => [resource.resourceType, resource.amount])) as Record<
          ResourceType,
          number
        >,
      }
      return playersById
    }, {}),
    ruleset,
  }
}
