import type { Player } from "#lib/rules-engine/turn-resolution/TurnState.ts"
import { type ActionSubmissionsForUpdate, GameplayRepository } from "./gameplay.repository.ts"

/**
 * Controls the submission-validation repository boundary for controller tests.
 */
export class GameplayRepositoryMock extends GameplayRepository {
  public updateCalls = 0

  private readonly actionSubmissionsContext: ActionSubmissionsForUpdate
  private readonly targetPlayers: Player[]

  public constructor({
    db,
    logger,
    clock,
    actionSubmissionsContext,
    targetPlayers = [],
  }: ConstructorParameters<typeof GameplayRepository>[0] & {
    actionSubmissionsContext: ActionSubmissionsForUpdate
    targetPlayers?: Player[]
  }) {
    super({ db, logger, clock })
    this.actionSubmissionsContext = actionSubmissionsContext
    this.targetPlayers = targetPlayers
  }

  public override async getActionSubmissionsForUpdate(): Promise<ActionSubmissionsForUpdate> {
    return this.actionSubmissionsContext
  }

  public override async updateActionSubmissions(): Promise<void> {
    this.updateCalls += 1
  }

  public override async getPlayersByIds(): Promise<Player[]> {
    return this.targetPlayers
  }
}
