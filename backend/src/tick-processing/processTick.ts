import { Result, type Logger } from "@guillaume-docquier/tools-ts"
import { type GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { type GameStatesRepository } from "#lib/db/gameStates.repository.ts"

/**
 * Processes all ticks that should advance at this point in time.
 * This will resolve all player actions, update the game state and schedule the next tick.
 */
export async function processTick({
  logger,
  gameTicksRepository,
  gameStatesRepository,
}: {
  logger: Logger
  gameTicksRepository: GameTicksRepository
  gameStatesRepository: GameStatesRepository
}): Promise<void> {
  // Lock the tables, can't update state or submit actions during ticks

  const ticksToProcessResult = await gameTicksRepository.getTicksToProcess()
  if (Result.isFailure(ticksToProcessResult)) {
    logger.error("Could not get ticks to process", { error: ticksToProcessResult.error })
    return
  }

  const ticksToProcess = ticksToProcessResult.value
  if (ticksToProcess.length === 0) {
    logger.debug("No ticks to process")
    return
  }

  // Needs to be a rollbackable transaction
  for (const { game, gameTick, gameState } of ticksToProcess) {
    logger.info("Processing tick", { game, gameTick, gameState })
    const startProcessingTickResult = await gameTicksRepository.startProcessingTick(gameTick)
    if (Result.isFailure(startProcessingTickResult)) {
      logger.error("Could not start processing tick", { gameTick, error: startProcessingTickResult.error })
      continue
    }

    const nextScheduledFor = computeNextTickDate({ date: gameTick.scheduledFor, tickIntervalSeconds: game.tickIntervalSeconds })
    const nextTick = gameTick.tick + 1

    const createGameTickResult = await gameTicksRepository.create({
      gameId: gameTick.gameId,
      tick: nextTick,
      scheduledFor: nextScheduledFor,
    })
    if (Result.isFailure(createGameTickResult)) {
      logger.error("Could not create next game tick", { gameTick, nextTick, nextScheduledFor, error: createGameTickResult.error })
      continue
    }

    await gameStatesRepository.update({ gameId: gameState.gameId }, { tick: nextTick, nextTickAt: nextScheduledFor })

    const finishProcessingTickResult = await gameTicksRepository.finishProcessingTick(gameTick)
    if (Result.isFailure(finishProcessingTickResult)) {
      logger.error("Could not finish processing tick", { gameTick, error: finishProcessingTickResult.error })
      continue
    }
  }
}

/**
 * Computes the date at which the next tick should happen.
 * The date argument is the last tick date to which we'll add tickIntervalSeconds.
 */
export function computeNextTickDate({ date, tickIntervalSeconds }: { date: Date; tickIntervalSeconds: number }): Date {
  return new Date(date.getTime() + tickIntervalSeconds * 1000)
}
