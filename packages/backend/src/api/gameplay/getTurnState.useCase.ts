import type { Result } from "@guillaume-docquier/tools-ts"
import type { TurnState } from "#api/gameplay/TurnState.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"
import type { GetTurnStateError } from "./getTurnState.error.ts"
import type { GetTurnStateQuery } from "./getTurnState.query.ts"

export class GetTurnStateUseCase {
  private readonly gameplayRepository: GameplayRepository

  public constructor({ gameplayRepository }: { gameplayRepository: GameplayRepository }) {
    this.gameplayRepository = gameplayRepository
  }

  public async execute({ gameId }: GetTurnStateQuery): Promise<Result<TurnState, GetTurnStateError>> {
    return await this.gameplayRepository.getTurnState({ gameId })
  }
}
