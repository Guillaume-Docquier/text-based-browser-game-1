import { Assert, Datetime, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { GAME_PLAYER_ACTION_RULES } from "#lib/db/gameplay/gamePlayerActions.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { ElapsedTimeContextProvider } from "#turn-processing/ElapsedTimeContextProvider.ts"
import { type ProcessedTurnModel, type TurnsRepository, type TurnToProcessModel } from "#turn-processing/turns.repository.ts"

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
   */
  public async processTurnsForever({ interval }: { interval: Time }): Promise<void> {
    let turnProcessingOutcome = await this.processNextDueTurn()
    while (turnProcessingOutcome === "processed") {
      turnProcessingOutcome = await this.processNextDueTurn()
    }

    setTimeout(() => void this.processTurnsForever({ interval }), Time.in(interval, UnitOfTime.MILLISECONDS))
  }

  /**
   * Processes the next turn that should advance at this point in time.
   * This will resolve all player actions, update the game state and schedule the next turn.
   */
  public async processNextDueTurn(): Promise<"processed" | "idle" | "failed"> {
    const processingLogger = this.logger.child({ scope: "processNextDueTurn", contextProviders: [new ElapsedTimeContextProvider()] })

    const turnToProcessResult = await this.createTransaction(async (tx) => {
      const nextTurnToProcessResult = await this.turnsRepository.getNextTurnForProcessing({ since: this.clock.now() }, tx)
      rollbackOnFailure(nextTurnToProcessResult, "Could not get next turn to process")

      if (nextTurnToProcessResult.value === undefined) {
        return undefined
      }

      if (nextTurnToProcessResult.value.gameStatus !== GameStatus.COLLECTING_ORDERS) {
        throw new TransactionRollback("Game cannot be processed in its current status", {
          cause: { status: nextTurnToProcessResult.value.gameStatus, expected: GameStatus.COLLECTING_ORDERS },
        })
      }

      const turnToProcess = await this.turnsRepository.startTurnProcessing(
        {
          turn: nextTurnToProcessResult.value,
          processingStartedAt: this.clock.now(),
          gameStatus: GameStatus.PROCESSING_TURN,
        },
        tx,
      )
      rollbackOnFailure(turnToProcess, "Could not start to process next turn")

      return turnToProcess.value
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
    const processedTurn = this.processTurn(turnToProcess)
    const saveResult = await this.turnsRepository.saveProcessedTurn(processedTurn)
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

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  private processTurn(turnToProcess: TurnToProcessModel): ProcessedTurnModel {
    let winnerAccountId: AccountId | undefined

    const playerStates = Object.entries(turnToProcess.players).reduce<
      Record<PlayerId, Array<{ resourceType: ResourceType; amount: number }>>
    >((processedPlayers, [playerId, { resources, actionType }]) => {
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

      processedPlayers[playerId] = updatedResources
      return processedPlayers
    }, {})

    const turnResult: Omit<ProcessedTurnModel, "gameStatus"> = {
      gameId: turnToProcess.gameId,
      turn: turnToProcess.turn,
      processedAt: this.clock.now(),
      playerResources: Object.entries(playerStates).flatMap(([playerId, playerResources]) =>
        playerResources.map((resource) => ({ ...resource, playerId })),
      ),
    }

    if (winnerAccountId === undefined) {
      return {
        ...turnResult,
        gameStatus: GameStatus.COLLECTING_ORDERS,
        nextTurn: {
          turn: turnToProcess.turn + 1,
          scheduledFor: Datetime.increment({
            date: turnToProcess.scheduledFor,
            time: Time.create(turnToProcess.turnIntervalSeconds, UnitOfTime.SECONDS),
          }),
        },
      }
    }

    return {
      ...turnResult,
      gameStatus: GameStatus.ENDED,
      winnerAccountId,
      endedAt: this.clock.now(),
    }
  }
}
