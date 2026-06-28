import { Assert, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { type ProcessedTickModel, type TicksRepository, type TickToProcessModel } from "#tick-processing/ticks.repository.ts"

/**
 * Processes the next tick that should advance at this point in time.
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
  const tickToProcessResult = await ticksRepository.getNextTickToProcess({ since: clock.now() })
  if (Result.isFailure(tickToProcessResult)) {
    logger.error("Could not get next tick to process", { error: tickToProcessResult.error })
    return
  }

  const tickToProcess = tickToProcessResult.value
  if (tickToProcess === undefined) {
    logger.debug("No tick to process")
    return
  }

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
