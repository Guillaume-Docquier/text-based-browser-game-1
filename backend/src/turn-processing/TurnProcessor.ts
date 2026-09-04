import { Datetime, type Logger, mulberry32Prng, Result, Rng, Time, UnitOfTime, branded } from "@guillaume-docquier/tools-ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { computeAvailableActions } from "#lib/rules-engine/action-submission/computeAvailableActions.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import { resolveTurn } from "#lib/rules-engine/turn-resolution/resolveTurn.ts"
import type { ResolveTurnError } from "#lib/rules-engine/turn-resolution/ResolveTurnError.ts"
import { ElapsedTimeContextProvider } from "#turn-processing/ElapsedTimeContextProvider.ts"
import type { ProcessedTurnModel, TurnsRepository, TurnToProcessModel } from "#turn-processing/turns.repository.ts"

const SCHEDULE_DRIFT_RATIO = 0.15
const MAX_SCHEDULE_DRIFT_MS = Time.in(Time.create(2, UnitOfTime.MINUTES), UnitOfTime.MILLISECONDS)

export class TurnProcessor {
  private readonly logger: Logger
  private readonly turnsRepository: TurnsRepository
  private readonly clock: Clock
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    turnsRepository,
    clock,
    createTransaction,
  }: {
    logger: Logger
    turnsRepository: TurnsRepository
    clock: Clock
    createTransaction: CreateTransaction
  }) {
    this.logger = logger
    this.turnsRepository = turnsRepository
    this.clock = clock
    this.createTransaction = createTransaction
  }

  /**
   * Processes due turns until there is no more immediate work, then schedules the next check.
   */
  public async processTurnsForever({ interval }: { interval: Time }): Promise<void> {
    let turnProcessingOutcome = await this.processNextDueTurn()
    while (turnProcessingOutcome === "processed") {
      turnProcessingOutcome = await this.processNextDueTurn()
    }

    setTimeout(
      () => {
        void this.processTurnsForever({ interval })
      },
      Time.in(interval, UnitOfTime.MILLISECONDS),
    )
  }

  /**
   * Processes the next turn that should advance at this point in time.
   * This will resolve all player actions, update the game state and schedule the next turn.
   */
  public async processNextDueTurn(): Promise<"processed" | "idle" | "failed"> {
    const processingLogger = this.logger.child({ scope: "processNextDueTurn", contextProviders: [new ElapsedTimeContextProvider()] })

    const turnToProcessResult = await this.createTransaction(async (tx) => {
      const since = this.clock.now()
      await this.turnsRepository.markDueTurnsAwaitingProcessing({ since }, tx)
      const nextTurnToProcess = await this.turnsRepository.getNextTurnForProcessing({ since }, tx)
      if (nextTurnToProcess === undefined) {
        return undefined
      }

      return await this.turnsRepository.startTurnProcessing(
        {
          turn: nextTurnToProcess,
          processingStartedAt: this.clock.now(),
        },
        tx,
      )
    })

    if (Result.isFailure(turnToProcessResult)) {
      processingLogger.error("Failed to acquire next turn to process", { error: turnToProcessResult.error })
      return "failed"
    }

    const turnToProcess = turnToProcessResult.value
    if (turnToProcess === undefined) {
      processingLogger.debug("No turn to process")
      return "idle"
    }

    processingLogger.info("Processing turn", { gameId: turnToProcess.gameId, turn: turnToProcess.turn })
    const processedTurnResult = this.processTurn(turnToProcess)
    if (Result.isFailure(processedTurnResult)) {
      processingLogger.error("Could not resolve turn", {
        gameId: turnToProcess.gameId,
        turn: turnToProcess.turn,
        error: processedTurnResult.error,
      })
      return "failed"
    }

    const saveResult = await this.turnsRepository.saveProcessedTurn(processedTurnResult.value)
    if (Result.isFailure(saveResult)) {
      processingLogger.error("Could not save processed turn", {
        gameId: turnToProcess.gameId,
        turn: turnToProcess.turn,
        error: saveResult.error,
      })
      return "failed"
    }

    processingLogger.info("Turn processed", { gameId: turnToProcess.gameId, turn: turnToProcess.turn })
    return "processed"
  }

  private processTurn(turnToProcess: TurnToProcessModel): Result<ProcessedTurnModel, ResolveTurnError> {
    const rng = Rng.fromState(turnToProcess.rngState, mulberry32Prng)
    const resolvedTurnResult = resolveTurn(
      {
        submittedActions: turnToProcess.submittedActions,
        players: turnToProcess.players,
        winnerPlayerId: undefined,
      },
      turnToProcess.ruleset,
      rng,
    )
    if (Result.isFailure(resolvedTurnResult)) {
      return resolvedTurnResult
    }

    const processedAt = this.clock.now()
    const turnResult: ProcessedTurnModel = {
      gameId: turnToProcess.gameId,
      turn: turnToProcess.turn,
      nextTurn: turnToProcess.turn + 1,
      availableActions: computeAvailableActions({
        playerIds: Object.values(resolvedTurnResult.value.players).map(({ id }) => id),
        ruleset: turnToProcess.ruleset,
      }),
      processedAt,
      rngState: rng.getState(),
      playerResources: Object.values(resolvedTurnResult.value.players).flatMap((player) =>
        Object.values(ResourceType).map((resourceType) => ({
          playerId: player.id,
          resourceType,
          amount: player.resources[resourceType],
        })),
      ),
    }

    if (resolvedTurnResult.value.winnerPlayerId === undefined) {
      return Result.Success({
        ...turnResult,
        nextTurnScheduledFor: getNextTurnScheduledFor({
          scheduledFor: turnToProcess.scheduledFor,
          processedAt,
          turnInterval: turnToProcess.turnInterval,
        }),
      })
    }

    return Result.Success({
      ...turnResult,
      winnerAccountId: branded(resolvedTurnResult.value.winnerPlayerId),
      endedAt: processedAt,
    })
  }
}

/**
 * Schedules from the processing time when we detect a schedule time drift.
 * This avoids quick-firing turn processing if there is a server downtime.
 */
function getNextTurnScheduledFor({
  scheduledFor,
  processedAt,
  turnInterval,
}: {
  scheduledFor: Date
  processedAt: Date
  turnInterval: Time
}): Date {
  const scheduleDriftMilliseconds = processedAt.getTime() - scheduledFor.getTime()
  const scheduleDriftThreshold = Math.min(Time.in(turnInterval, UnitOfTime.MILLISECONDS) * SCHEDULE_DRIFT_RATIO, MAX_SCHEDULE_DRIFT_MS)
  const scheduleFrom = scheduleDriftMilliseconds > scheduleDriftThreshold ? processedAt : scheduledFor

  return Datetime.increment({
    date: scheduleFrom,
    time: turnInterval,
  })
}
