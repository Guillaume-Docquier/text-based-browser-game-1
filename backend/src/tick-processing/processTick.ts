import { type Logger } from "@guillaume-docquier/tools-ts"
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

  const ticksToProcess = await gameTicksRepository.getTicksToProcess()
  if (ticksToProcess.length === 0) {
    logger.debug("No ticks to process")
    return
  }

  for (const { game, gameTick, gameState } of ticksToProcess) {
    logger.info("Processing tick", { game, gameTick, gameState })
    await gameTicksRepository.startProcessingTick(gameTick)

    const nextScheduledFor = computeNextTickDate({ date: gameTick.scheduledFor, tickIntervalSeconds: game.tickIntervalSeconds })
    const nextTick = gameTick.tick + 1

    await gameTicksRepository.create({ gameId: gameTick.gameId, tick: nextTick, scheduledFor: nextScheduledFor })
    await gameStatesRepository.update({ gameId: gameState.gameId }, { tick: nextTick, nextTickAt: nextScheduledFor })

    await gameTicksRepository.finishProcessingTick(gameTick)
  }
}

/**
 * Computes the date at which the next tick should happen.
 * The date argument is the last tick date to which we'll add tickIntervalSeconds.
 */
export function computeNextTickDate({ date, tickIntervalSeconds }: { date: Date; tickIntervalSeconds: number }): Date {
  return new Date(date.getTime() + tickIntervalSeconds * 1000)
}
