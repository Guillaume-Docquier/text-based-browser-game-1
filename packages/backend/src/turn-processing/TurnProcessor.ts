import { Datetime, type Logger, mulberry32Prng, Result, Rng, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
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
   *
   * Handles all turn processing duties:
   * - moves due turns to AWAITING_PROCESSING
   * - processes all turns that are AWAITING_PROCESSING
   * - creates next turns and schedules their processing
   */
  public async processTurnsForever({ interval }: { interval: Time }): Promise<void> {
    await this.turnsRepository.moveDueTurnsToAwaitingProcessing({ since: this.clock.now() })

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
   * Runs Turn Resolution and schedules the next Turn.
   */
  public async processNextDueTurn(): Promise<"processed" | "idle" | "failed"> {
    const processingLogger = this.logger.child({ scope: "processNextDueTurn", contextProviders: [new ElapsedTimeContextProvider()] })

    const turnToProcessResult = await this.createTransaction(async (tx) => {
      const nextTurnToProcess = await this.turnsRepository.getNextTurnForProcessing({ since: this.clock.now() }, tx)
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
    const processedTurn = this.processTurn(turnToProcess)
    const saveResult = await this.turnsRepository.saveProcessedTurn(processedTurn)
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

  private processTurn({ gameId, turn, closedAt, turnInterval, rngState, players, planets }: TurnToProcessModel): ProcessedTurnModel {
    const rng = Rng.fromState(rngState, mulberry32Prng)
    resolveTurn({ gameId, turn, players, planets }, rng)

    const processedAt = this.clock.now()
    return {
      gameId,
      turn,
      processedAt,
      rngState: rng.getState(),
      nextTurn: turn + 1,
      nextTurnScheduledFor: getNextTurnScheduledFor({ turnClosedAt: closedAt, processedAt, turnInterval }),
    }
  }
}

/**
 * Schedules from the processing time when we detect a schedule time drift.
 * This avoids quick-firing turn processing if there is a server downtime.
 */
function getNextTurnScheduledFor({
  turnClosedAt,
  processedAt,
  turnInterval,
}: {
  turnClosedAt: Date
  processedAt: Date
  turnInterval: Time
}): Date {
  const scheduleDriftMilliseconds = processedAt.getTime() - turnClosedAt.getTime()
  const scheduleDriftThreshold = Math.min(Time.in(turnInterval, UnitOfTime.MILLISECONDS) * SCHEDULE_DRIFT_RATIO, MAX_SCHEDULE_DRIFT_MS)
  const scheduleFrom = scheduleDriftMilliseconds > scheduleDriftThreshold ? processedAt : turnClosedAt

  return Datetime.increment({
    date: scheduleFrom,
    time: turnInterval,
  })
}
