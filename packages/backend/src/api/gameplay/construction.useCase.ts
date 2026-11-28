import { Result, type Logger } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { constructionProblem, TRADE_CENTER_COST } from "shared/domain/world/buildings/ConstructionOrder.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { ConstructionCommand } from "./construction.command.ts"
import { ConstructionRollbackError, type ConstructionError } from "./construction.error.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"

export class ConstructionUseCase {
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction
  private readonly logger: Logger
  public constructor({
    gameplayRepository,
    createTransaction,
    logger,
  }: {
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
    logger: Logger
  }) {
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
    this.logger = logger.child({ scope: "construction-use-case" })
  }

  public async execute(command: ConstructionCommand, { playerId }: { playerId: PlayerId }): Promise<Result<void, ConstructionError>> {
    const { gameId, turn } = command
    const result = await this.createTransaction(async (tx) => {
      const context = await this.gameplayRepository.lockOpenTurn({ gameId, turn }, tx)
      if (context === undefined) {
        throw new ConstructionRollbackError("TURN_NOT_OPEN")
      }
      if (command.action === "cancel") {
        const removed = await this.gameplayRepository.cancelConstruction(context, { playerId, orderId: command.orderId }, tx)
        if (!removed) {
          throw new ConstructionRollbackError("ORDER_NOT_FOUND")
        }
        return
      }
      const { planetId, type, site } = command
      const inputs = await this.gameplayRepository.getConstructionInputs({ gameId, turn, playerId, planetId }, tx)
      const problem = constructionProblem({ ...inputs, playerId, site })
      if (problem !== undefined) {
        throw new ConstructionRollbackError(problem)
      }
      await this.gameplayRepository.submitConstruction(context, { playerId, planetId, type, site, cost: TRADE_CENTER_COST }, tx)
    })
    if (Result.isFailure(result)) {
      if (result.error instanceof ConstructionRollbackError) {
        return Result.Failure(result.error.code)
      }
      this.logger.error("Could not update construction plan", { gameId, turn, error: result.error })
      return Result.Failure("UNKNOWN")
    }
    return Result.Success(undefined)
  }
}
