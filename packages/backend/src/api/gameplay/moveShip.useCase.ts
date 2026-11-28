import { Result, type Logger } from "@guillaume-docquier/tools-ts"
import { canAfford } from "shared/domain/games/credits.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { SHIP_TEMPLATES } from "shared/domain/world/ships/Ship.ts"
import { quoteTravel } from "shared/domain/world/ships/travel.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { MoveShipCommand } from "./moveShip.command.ts"
import { MoveShipRollbackError, type MoveShipError } from "./moveShip.error.ts"

export class MoveShipUseCase {
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
    this.logger = logger.child({ scope: "move-ship-use-case" })
  }
  public async execute(command: MoveShipCommand, { playerId }: { playerId: PlayerId }): Promise<Result<void, MoveShipError>> {
    const { gameId, turn } = command
    const outcome = await this.createTransaction(async (tx) => {
      const locked = await this.gameplayRepository.lockOpenTurn({ gameId, turn }, tx)
      if (locked === undefined) {
        throw new MoveShipRollbackError("TURN_NOT_OPEN")
      }
      if (command.action === "cancel") {
        if (!(await this.gameplayRepository.cancelMove(locked, playerId, command.orderId, tx))) {
          throw new MoveShipRollbackError("ORDER_NOT_FOUND")
        }
        return
      }
      const { ship, origin, availableCredits, reserved } = await this.gameplayRepository.getMoveInputs(locked, playerId, command.shipId, tx)
      if (ship === undefined || origin === undefined || reserved) {
        throw new MoveShipRollbackError("SHIP_UNAVAILABLE")
      }
      const destination = await this.gameplayRepository.getTravelBody(gameId, command.destination, tx)
      if (destination === undefined || (destination.kind === origin.kind && destination.id === origin.id)) {
        throw new MoveShipRollbackError("DESTINATION_UNAVAILABLE")
      }
      const route = quoteTravel(origin, destination, SHIP_TEMPLATES[ship.type], [])
      if (!canAfford(availableCredits, route.cost)) {
        throw new MoveShipRollbackError("INSUFFICIENT_CREDITS")
      }
      await this.gameplayRepository.submitMove(locked, playerId, ship.id, route, tx)
    })
    if (Result.isFailure(outcome)) {
      if (outcome.error instanceof MoveShipRollbackError) {
        return Result.Failure(outcome.error.code)
      }
      this.logger.error("Could not update ship move", { gameId, turn, error: outcome.error })
      return Result.Failure("UNKNOWN")
    }
    return Result.Success(undefined)
  }
}
