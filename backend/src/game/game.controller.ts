import type { GamesRepository } from "#db/GamesRepository.ts"

export class GameController {
  private readonly gamesRepository
  private readonly gameId

  public constructor({ gamesRepository, gameId }: { gamesRepository: GamesRepository; gameId: number }) {
    this.gamesRepository = gamesRepository
    this.gameId = gameId
  }

  public async getTick(): Promise<number | undefined> {
    return (await this.gamesRepository.findById({ gameId: this.gameId }))?.tick
  }

  public async incrementTick({ by }: { by: number }): Promise<number | undefined> {
    return (await this.gamesRepository.incrementTick({ gameId: this.gameId, by }))?.tick
  }
}
