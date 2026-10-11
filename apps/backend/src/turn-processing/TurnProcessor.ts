import { Datetime, type Logger, mulberry32Prng, Result, Rng, Time, UnitOfTime, branded } from "@guillaume-docquier/tools-ts"
import { computeAvailableActions } from "shared/action-submission/computeAvailableActions.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { ResolvedTurnState } from "shared/turn-resolution/ResolvedTurnState.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import type { ResolveTurnError } from "shared/turn-resolution/ResolveTurnError.ts"
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
    await this.turnsRepository.markDueTurnsAwaitingProcessing({ since: this.clock.now() })

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
    const initialPlanetOwners = new Map(Object.values(turnToProcess.planets).map((planet) => [planet.id, planet.ownerPlayerId]))
    const initialFleetIds = Object.values(turnToProcess.fleets).map((fleet) => fleet.id)
    const rng = Rng.fromState(turnToProcess.rngState, mulberry32Prng)
    const resolvedTurnResult = resolveTurn(
      {
        gameId: turnToProcess.gameId,
        turn: turnToProcess.turn,
        submittedActions: turnToProcess.submittedActions,
        players: turnToProcess.players,
        planets: turnToProcess.planets,
        fleets: turnToProcess.fleets,
        winnerPlayerId: undefined,
      },
      turnToProcess.ruleset,
      rng,
    )
    if (Result.isFailure(resolvedTurnResult)) {
      return resolvedTurnResult
    }

    const processedAt = this.clock.now()
    const resolved = resolvedTurnResult.value
    const fleetChanges = projectFleetChanges(resolved, initialFleetIds)
    const turnResult: ProcessedTurnModel = {
      gameId: turnToProcess.gameId,
      turn: turnToProcess.turn,
      nextTurn: turnToProcess.turn + 1,
      availableActions: computeAvailableActions({
        playerIds: Object.values(resolvedTurnResult.value.players).map(({ id }) => id),
        ruleset: turnToProcess.ruleset,
        fleets: Object.values(resolvedTurnResult.value.fleets),
      }),
      processedAt,
      rngState: rng.getState(),
      playerResources: projectPlayerResources(resolved),
      planetOwnersToUpdate: projectPlanetOwners(resolved, initialPlanetOwners),
      ...fleetChanges,
    }

    if (resolvedTurnResult.value.winnerPlayerId === undefined) {
      return Result.Success({
        ...turnResult,
        nextTurnScheduledFor: getNextTurnScheduledFor({
          turnClosedAt: turnToProcess.closedAt,
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

function projectFleetChanges(
  resolved: ResolvedTurnState,
  initialFleetIds: FleetId[],
): Pick<ProcessedTurnModel, "fleetsToUpdate" | "fleetIdsToDelete"> {
  const fleetsToUpdate = []
  const fleetIdsToDelete = initialFleetIds.filter((id) => resolved.fleets[id] === undefined)
  for (const fleet of Object.values(resolved.fleets)) {
    if (fleet.strength === 0) {
      fleetIdsToDelete.push(fleet.id)
    } else {
      fleetsToUpdate.push(fleet)
    }
  }

  return { fleetsToUpdate, fleetIdsToDelete }
}

function projectPlayerResources(resolved: ResolvedTurnState): ProcessedTurnModel["playerResources"] {
  return Object.values(resolved.players).flatMap((player) =>
    Object.values(ResourceType).map((resourceType) => ({ playerId: player.id, resourceType, amount: player.resources[resourceType] })),
  )
}

function projectPlanetOwners(
  resolved: ResolvedTurnState,
  initialPlanetOwners: Map<PlanetId, PlayerId | null>,
): ProcessedTurnModel["planetOwnersToUpdate"] {
  return Object.values(resolved.planets).flatMap((planet) =>
    initialPlanetOwners.get(planet.id) === planet.ownerPlayerId ? [] : [{ id: planet.id, ownerPlayerId: planet.ownerPlayerId }],
  )
}
