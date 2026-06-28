import { Assert, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { rollbackOnFailure } from "#lib/errors.ts"
import { type ProcessedTickModel, type TicksRepository, type TickToProcessModel } from "#tick-processing/ticks.repository.ts"

export class TickProcessor {
  private readonly logger: Logger
  private readonly ticksRepository: TicksRepository
  private readonly clock: Clock
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    ticksRepository,
    clock,
    createTransaction,
  }: {
    logger: Logger
    ticksRepository: TicksRepository
    clock: Clock
    createTransaction: CreateTransaction
  }) {
    this.logger = logger
    this.ticksRepository = ticksRepository
    this.clock = clock
    this.createTransaction = createTransaction
  }

  /**
   * Processes the next tick that should advance at this point in time.
   * This will resolve all player actions, update the game state and schedule the next tick.
   */
  public async processNextDueTick(): Promise<void> {
    const tickToProcessResult = await this.createTransaction(async (tx) => {
      const nextTickToProcessResult = await this.ticksRepository.getNextTickToProcess({ since: this.clock.now() }, tx)
      rollbackOnFailure(nextTickToProcessResult, "Could not get next tick to process")

      if (nextTickToProcessResult.value === undefined) {
        return undefined
      }

      const started = await this.ticksRepository.startProcessingTick(nextTickToProcessResult.value, tx)
      rollbackOnFailure(started, "Could not start to process next tick")

      return nextTickToProcessResult.value
    })

    if (Result.isFailure(tickToProcessResult)) {
      this.logger.error("Failed to acquire next tick to process", { error: tickToProcessResult.error })
      return
    }

    const tickToProcess = tickToProcessResult.value
    if (tickToProcess === undefined) {
      this.logger.debug("No tick to process")
      return
    }

    this.logger.info("Processing tick", { gameId: tickToProcess.gameId, tick: tickToProcess.tick })
    const processedTick = this.processTick(tickToProcess)
    const saveResult = await this.ticksRepository.saveProcessedTick(processedTick)
    if (Result.isFailure(saveResult)) {
      this.logger.error("Could not save processed tick", {
        gameId: tickToProcess.gameId,
        tick: tickToProcess.tick,
        error: saveResult.error,
      })
    }
  }

  private processTick(tickToProcess: TickToProcessModel): ProcessedTickModel {
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
      processedAt: this.clock.now(),
      players,
      winnerAccountId,
      nextTick,
    }
  }
}
