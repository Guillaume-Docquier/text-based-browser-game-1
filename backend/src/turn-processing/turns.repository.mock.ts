import { branded, Result } from "@guillaume-docquier/tools-ts"
import {
  type ProcessedTurnModel,
  TurnsRepository,
  type TurnForProcessing,
  type TurnToProcessModel,
} from "#turn-processing/turns.repository.ts"

/**
 * Supplies one controlled Turn and records persistence calls for processor tests.
 */
export class TurnsRepositoryMock extends TurnsRepository {
  public saveCalls = 0
  public resetCalls = 0

  private readonly turnToProcess: TurnToProcessModel

  public constructor({
    db,
    logger,
    turnToProcess,
  }: ConstructorParameters<typeof TurnsRepository>[0] & {
    turnToProcess: TurnToProcessModel
  }) {
    super({ db, logger })
    this.turnToProcess = turnToProcess
  }

  public override async getNextTurnForProcessing(): Promise<TurnForProcessing> {
    return branded<TurnForProcessing>({ gameId: this.turnToProcess.gameId, turn: this.turnToProcess.turn })
  }

  public override async startTurnProcessing(): Promise<TurnToProcessModel> {
    return this.turnToProcess
  }

  public override async saveProcessedTurn(_processedTurnModel: ProcessedTurnModel): Promise<Result<{ saved: true }, string>> {
    this.saveCalls += 1
    return Result.Success({ saved: true })
  }

  public override async resetProcessingAttempt(): Promise<Result<{ reset: true }, string>> {
    this.resetCalls += 1
    return Result.Success({ reset: true })
  }
}
