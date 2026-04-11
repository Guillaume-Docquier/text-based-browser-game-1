import type { Logger } from "@guillaume-docquier/tools-ts"
import { type GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"

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
    logger.info("No ticks to process")
    return
  }

  for (const { game_ticks: gameTick, game_states: gameState } of ticksToProcess) {
    logger.info("Processing tick", { gameTick, gameState })
    await gameTicksRepository.startProcessingTick(gameTick)

    // 1 minute per tick for now, we'll make this configurable
    const nextScheduledFor = new Date(gameTick.scheduledFor)
    nextScheduledFor.setMinutes(nextScheduledFor.getMinutes() + 1)

    const nextTick = gameTick.tick + 1

    await gameTicksRepository.create({ gameId: gameTick.gameId, tick: nextTick, scheduledFor: nextScheduledFor })
    await gameStatesRepository.update({ gameId: gameState.gameId }, { tick: nextTick, nextTickAt: nextScheduledFor })

    await gameTicksRepository.finishProcessingTick(gameTick)
  }
}
