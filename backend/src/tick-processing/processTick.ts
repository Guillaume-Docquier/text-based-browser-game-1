import { Result, type Logger } from "@guillaume-docquier/tools-ts"
import { type GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { type GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { type GamePlayerResourcesRepository } from "#lib/db/gamePlayerResources.repository.ts"
import { type GamesRepository } from "#lib/db/games.repository.ts"
import { ResourceType } from "#lib/gameResources.ts"
import { GAME_PLAYER_ACTION_RULES, GamePlayerActionType } from "#lib/gamePlayerActions.ts"
import { type GamePlayerActionsRepository } from "#lib/db/gamePlayerActions.repository.ts"

/**
 * Processes all ticks that should advance at this point in time.
 * This will resolve all player actions, update the game state and schedule the next tick.
 */
export async function processTick({
  logger,
  gameTicksRepository,
  gameStatesRepository,
  gamePlayerResourcesRepository,
  gamesRepository,
  gamePlayerActionsRepository,
}: {
  logger: Logger
  gameTicksRepository: GameTicksRepository
  gameStatesRepository: GameStatesRepository
  gamePlayerResourcesRepository: GamePlayerResourcesRepository
  gamesRepository: GamesRepository
  gamePlayerActionsRepository: GamePlayerActionsRepository
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

    const playerIdsResult = await gamesRepository.getPlayerIds({ gameId: game.id })
    if (Result.isFailure(playerIdsResult)) {
      logger.error("Could not get game players while processing tick", { gameTick, error: playerIdsResult.error })
      continue
    }

    const gamePlayerActionsResult = await gamePlayerActionsRepository.getByGameIdAndTick({ gameId: game.id, tick: gameState.tick })
    if (Result.isFailure(gamePlayerActionsResult)) {
      logger.error("Could not get game player actions while processing tick", { gameTick, error: gamePlayerActionsResult.error })
      continue
    }

    const gamePlayerActionByPlayerId = new Map(gamePlayerActionsResult.value.map((gamePlayerAction) => [gamePlayerAction.playerId, gamePlayerAction]))

    let couldNotProcessPlayers = false
    let winnerPlayerId: number | undefined
    for (const playerId of playerIdsResult.value) {
      const incrementMoneyResult = await gamePlayerResourcesRepository.updateResource({
        gameId: game.id,
        playerId,
        resourceType: ResourceType.MONEY,
        amountDelta: 1,
      })
      if (Result.isFailure(incrementMoneyResult)) {
        logger.error("Could not increment player money", { playerId, gameTick, error: incrementMoneyResult.error })
        couldNotProcessPlayers = true
        break
      }

      const selectedAction = gamePlayerActionByPlayerId.get(playerId)
      if (selectedAction === undefined) {
        continue
      }

      const actionRule = GAME_PLAYER_ACTION_RULES[selectedAction.actionType]
      if (actionRule === undefined) {
        logger.error("Encountered unsupported action type while processing tick", { gameTick, playerId, actionType: selectedAction.actionType })
        couldNotProcessPlayers = true
        break
      }

      const subtractActionCostResult = await gamePlayerResourcesRepository.updateResource({
        gameId: game.id,
        playerId,
        resourceType: ResourceType.MONEY,
        amountDelta: -actionRule.costMoney,
      })
      if (Result.isFailure(subtractActionCostResult)) {
        logger.error("Could not subtract action cost", { playerId, gameTick, actionType: selectedAction.actionType, error: subtractActionCostResult.error })
        couldNotProcessPlayers = true
        break
      }

      if (selectedAction.actionType === GamePlayerActionType.MAKE_MORE_MONEY) {
        const addActionRewardResult = await gamePlayerResourcesRepository.updateResource({
          gameId: game.id,
          playerId,
          resourceType: ResourceType.MONEY,
          amountDelta: actionRule.rewardMoney,
        })
        if (Result.isFailure(addActionRewardResult)) {
          logger.error("Could not add action reward", { playerId, gameTick, actionType: selectedAction.actionType, error: addActionRewardResult.error })
          couldNotProcessPlayers = true
          break
        }

        continue
      }

      if (selectedAction.actionType === GamePlayerActionType.WIN_THE_GAME) {
        const endGameResult = await gamesRepository.endWithWinner({ gameId: game.id, winnerPlayerId: playerId })
        if (Result.isFailure(endGameResult)) {
          logger.error("Could not end game with winner", { playerId, gameTick, error: endGameResult.error })
          couldNotProcessPlayers = true
        } else {
          winnerPlayerId = playerId
        }

        break
      }
    }
    if (couldNotProcessPlayers) {
      continue
    }

    if (winnerPlayerId === undefined) {
      const createGameTickResult = await gameTicksRepository.create({
        gameId: gameTick.gameId,
        tick: nextTick,
        scheduledFor: nextScheduledFor,
      })
      if (Result.isFailure(createGameTickResult)) {
        logger.error("Could not create next game tick", { gameTick, nextTick, nextScheduledFor, error: createGameTickResult.error })
        continue
      }

      const updateGameStateResult = await gameStatesRepository.update(
        { gameId: gameState.gameId },
        { tick: nextTick, nextTickAt: nextScheduledFor },
      )
      if (Result.isFailure(updateGameStateResult)) {
        logger.error("Could not update game state", { gameState, nextTick, nextScheduledFor, error: updateGameStateResult.error })
        continue
      }
    }

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
