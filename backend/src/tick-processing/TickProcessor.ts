import { Assert, branded, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { v7 } from "uuid"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import type { UnitId } from "#lib/db/gameplay/UnitId.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { ElapsedTimeContextProvider } from "#tick-processing/ElapsedTimeContextProvider.ts"
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
   * Processes due ticks until there is no more immediate work, then schedules the next check.
   */
  public async processTicksForever({ interval }: { interval: Time }): Promise<void> {
    let tickProcessingOutcome = await this.processNextDueTick()
    while (tickProcessingOutcome === "processed") {
      tickProcessingOutcome = await this.processNextDueTick()
    }

    setTimeout(() => void this.processTicksForever({ interval }), Time.in(interval, UnitOfTime.MILLISECONDS))
  }

  /**
   * Processes the next tick that should advance at this point in time.
   * This will resolve all player actions, update the game state and schedule the next tick.
   */
  public async processNextDueTick(): Promise<"processed" | "idle" | "failed"> {
    const processingLogger = this.logger.child({ scope: "processNextDueTick", contextProviders: [new ElapsedTimeContextProvider()] })

    const tickToProcessResult = await this.createTransaction(async (tx) => {
      const nextTickToProcessResult = await this.ticksRepository.getNextTickForProcessing({ since: this.clock.now() }, tx)
      rollbackOnFailure(nextTickToProcessResult, "Could not get next tick to process")

      if (nextTickToProcessResult.value === undefined) {
        return undefined
      }

      if (nextTickToProcessResult.value.gameStatus !== GameStatus.COLLECTING_ORDERS) {
        throw new TransactionRollback("Game cannot be processed in its current status", {
          cause: { status: nextTickToProcessResult.value.gameStatus, expected: GameStatus.COLLECTING_ORDERS },
        })
      }

      const tickToProcess = await this.ticksRepository.startTickProcessing(
        {
          tick: nextTickToProcessResult.value,
          processingStartedAt: this.clock.now(),
          gameStatus: GameStatus.PROCESSING_TICK,
        },
        tx,
      )
      rollbackOnFailure(tickToProcess, "Could not start to process next tick")

      return tickToProcess.value
    })

    if (Result.isFailure(tickToProcessResult)) {
      processingLogger.error("Failed to acquire next tick to process", { error: tickToProcessResult.error })
      return "failed"
    }

    const tickToProcess = tickToProcessResult.value
    if (tickToProcess === undefined) {
      processingLogger.debug("No tick to process")
      return "idle"
    }

    processingLogger.info("Processing tick", { gameId: tickToProcess.gameId, tick: tickToProcess.tick })
    const processedTick = this.processTick(tickToProcess)
    const saveResult = await this.ticksRepository.saveProcessedTick(processedTick)
    if (Result.isFailure(saveResult)) {
      processingLogger.error("Could not save processed tick", {
        gameId: tickToProcess.gameId,
        tick: tickToProcess.tick,
        error: saveResult.error,
      })
      return "failed"
    }

    processingLogger.info("Tick processed", { gameId: tickToProcess.gameId, tick: tickToProcess.tick })
    return "processed"
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  private processTick(tickToProcess: TickToProcessModel): ProcessedTickModel {
    let winnerAccountId: AccountId | undefined
    const units = { ...tickToProcess.units }

    const playerStates = Object.entries(tickToProcess.players).reduce<
      Record<PlayerId, Array<{ resourceType: ResourceType; amount: number }>>
    >((processedPlayers, [playerId, { resources, action }]) => {
      const updatedResources = resources.map((resource) => ({ ...resource }))
      const money = updatedResources.find((resource) => resource.resourceType === ResourceType.MONEY)
      Assert.isDefined(money)

      money.amount += 1

      if (action !== undefined) {
        const actionRule = GAME_PLAYER_ACTION_RULES[action.actionType]
        if (actionRule.costMoney <= money.amount) {
          money.amount -= actionRule.costMoney
          money.amount += actionRule.rewardMoney

          if (action.actionType === GamePlayerActionType.WIN_THE_GAME && winnerAccountId === undefined) {
            winnerAccountId = playerId
          }

          if (action.actionType === GamePlayerActionType.BUILD_UNIT) {
            const unitId = branded<UnitId>(v7())
            units[unitId] = {
              id: unitId,
              playerId,
              location: action.destination,
            }
          }
        }
      }

      processedPlayers[playerId] = updatedResources
      return processedPlayers
    }, {})

    const tickResult: Omit<ProcessedTickModel, "gameStatus"> = {
      gameId: tickToProcess.gameId,
      tick: tickToProcess.tick,
      processedAt: this.clock.now(),
      playerResources: Object.entries(playerStates).flatMap(([playerId, playerResources]) =>
        playerResources.map((resource) => ({ ...resource, playerId })),
      ),
      units,
    }

    if (winnerAccountId === undefined) {
      return {
        ...tickResult,
        gameStatus: GameStatus.COLLECTING_ORDERS,
        nextTick: {
          tick: tickToProcess.tick + 1,
          scheduledFor: Datetime.increment({
            date: tickToProcess.scheduledFor,
            time: Time.create(tickToProcess.tickIntervalSeconds, UnitOfTime.SECONDS),
          }),
        },
      }
    }

    return {
      ...tickResult,
      gameStatus: GameStatus.ENDED,
      winnerAccountId,
      endedAt: this.clock.now(),
    }
  }
}
