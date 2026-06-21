import { Assert, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { rollbackOnFailure } from "#lib/errors.ts"
import { type ProcessedTickModel, type TicksRepository, type TickToProcessModel } from "#tick-processing/ticks.repository.ts"

/**
 * Processes all ticks that should advance at this point in time.
 * This will resolve all player actions, update the game state and schedule the next tick.
 */
export async function processTick({
  logger,
  ticksRepository,
  clock,
  createTransaction,
}: {
  logger: Logger
  ticksRepository: TicksRepository
  clock: Clock
  createTransaction: CreateTransaction
}): Promise<void> {
  const ticksToProcessResult = await ticksRepository.getDueTicks({ since: clock.now() })
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
    ticksToProcess.map(async ({ gameId, tick }) => {
      logger.info("Processing tick", { gameId, tick })
      const processResult = await Result.tryCatch(
        createTransaction(async (tx) => {
          const tickToProcessResult = await ticksRepository.getTickToProcessForMutation({ gameId, tick }, tx)
          rollbackOnFailure(tickToProcessResult, "Failed to get locked tick")
          if (tickToProcessResult.value === undefined) {
            return
          }

          const processedTick = processTickInMemory(tickToProcessResult.value, clock)
          const saveResult = await ticksRepository.saveProcessedTickForMutation(processedTick, tx)
          rollbackOnFailure(saveResult, "Failed to save locked tick")
        }),
      )
      if (Result.isFailure(processResult)) {
        logger.error("Could not process tick", { gameId, tick, error: processResult.error })
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
