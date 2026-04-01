import type { Game, GamesRepository } from "#db/GamesRepository.ts"

export class GamesController {
  private readonly gamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async getAll(): Promise<Game[]> {
    return await this.gamesRepository.getAll()
  }

  public async findById({ gameId }: { gameId: number }): Promise<Game | undefined> {
    return await this.gamesRepository.findById({ gameId })
  }
}
