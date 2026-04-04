import type { GameRow, GameRowInsert, GamesRepository } from "#db/GamesRepository.ts"
import z from "zod"

export class GamesController {
  private readonly gamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async create(newGame: GameRowInsert): Promise<Game> {
    return toGame(await this.gamesRepository.create(newGame))
  }

  public async getAll(): Promise<Game[]> {
    return (await this.gamesRepository.getAll()).map((gameRow) => toGame(gameRow))
  }

  public async findById({ gameId }: { gameId: number }): Promise<Game | undefined> {
    return toGame(await this.gamesRepository.findById({ gameId }))
  }
}

export type Game = z.infer<typeof Game>
/**
 * For now Game and GameRow are the same, but they won't always be.
 * This is a POC for mapping from one to the other, to decouple the DB and the app
 */
export const Game = z.object({
  name: z.string(),
  id: z.number(),
  createdByPlayerId: z.number(),
  maxPlayerCount: z.number(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})

function toGame(gameRow: GameRow): Game
function toGame(gameRow: GameRow | undefined): Game | undefined
function toGame(gameRow: GameRow | undefined): Game | undefined {
  if (gameRow === undefined) {
    return undefined
  }

  return gameRow
}
