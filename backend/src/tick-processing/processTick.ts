import { Assert, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { type ProcessedTickModel, type TicksRepository, type TickToProcessModel } from "#tick-processing/ticks.repository.ts"

/**
 * Processes all ticks that should advance at this point in time.
 * This will resolve all player actions, update the game state and schedule the next tick.
 */
export async function processTick({
  logger,
  ticksRepository,
  clock,
}: {
  logger: Logger
  ticksRepository: TicksRepository
  clock: Clock
}): Promise<void> {
  const ticksToProcessResult = await ticksRepository.getTicksToProcess({ since: clock.now() })
  if (Result.isFailure(ticksToProcessResult)) {
    logger.error("Could not get ticks to process", { error: ticksToProcessResult.error })
    return
  }

  const ticksToProcess = ticksToProcessResult.value
  if (ticksToProcess.length === 0) {
    logger.debug("No ticks to process")
    return
  }

  // Long term we'll probably want to have each invocation process 1 tick a distribute the work on multiple workers
  // But for now this will work just fine
  await Promise.allSettled(
    ticksToProcess.map(async (tickToProcess) => {
      logger.info("Processing tick", { gameId: tickToProcess.gameId, tick: tickToProcess.tick })
      const processedTick = processTickInMemory(tickToProcess, clock)
      const saveResult = await ticksRepository.saveProcessedTick(processedTick)
      if (Result.isFailure(saveResult)) {
        logger.error("Could not save processed tick", {
          gameId: tickToProcess.gameId,
          tick: tickToProcess.tick,
          error: saveResult.error,
        })
      }
    }),
  )
}

function processTickInMemory(tickToProcess: TickToProcessModel, clock: Clock): ProcessedTickModel {
  let winnerAccountId: AccountId | undefined

  const players = Object.entries(tickToProcess.players).reduce<ProcessedTickModel["players"]>(
    (processedPlayers, [playerId, { resources, actionType }]) => {
      const updatedResources = resources.map((resource) => ({ ...resource }))
      const money = updatedResources.find((resource) => resource.resourceType === ResourceType.MONEY)
      Assert.isDefined(money)

      money.amount += 1

      if (actionType !== undefined) {
        const actionRule = GAME_PLAYER_ACTION_RULES[actionType]
        if (actionRule.costMoney <= money.amount) {
          money.amount -= actionRule.costMoney
          money.amount += actionRule.rewardMoney

          if (actionType === GamePlayerActionType.WIN_THE_GAME && winnerAccountId === undefined) {
            winnerAccountId = playerId
          }
        }
      }

      processedPlayers[playerId] = {
        resources: updatedResources,
      }
      return processedPlayers
    },
    {},
  )

  const nextTick =
    winnerAccountId === undefined
      ? {
          tick: tickToProcess.tick + 1,
          scheduledFor: Datetime.increment({
            date: tickToProcess.scheduledFor,
            time: Time.create(tickToProcess.tickIntervalSeconds, UnitOfTime.SECONDS),
          }),
        }
      : undefined

  return {
    gameId: tickToProcess.gameId,
    tick: tickToProcess.tick,
    processedAt: clock.now(),
    players,
    winnerAccountId,
    nextTick,
  }
}
