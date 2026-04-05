import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow, GameRowInsert } from "#db/GamesRepository.ts"
import z from "zod"

export class GamesController {
  private readonly gamesRepository: GamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async create(newGame: GameInsert): Promise<CreatedGame> {
    return await this.gamesRepository.create(newGame)
  }

  public async getAll(): Promise<GameSummary[]> {
    return await this.gamesRepository.getAll()
  }

  public async findById({ gameId }: { gameId: number }): Promise<GameSummary | undefined> {
    return await this.gamesRepository.findById({ gameId })
  }
}

export type GameInsert = z.infer<typeof GameInsert>
export const GameInsert = z.object({
  name: z.string(),
  createdByPlayerId: z.number(),
  maxPlayerCount: z.number(),
}) satisfies z.ZodType<GameRowInsert>

export type CreatedGame = z.infer<typeof CreatedGame>
export const CreatedGame = z.object({
  name: z.string(),
  id: z.number(),
  createdByPlayerId: z.number(),
  maxPlayerCount: z.number(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
}) satisfies z.ZodType<GameRow>

export type GameSummaryPlayer = z.infer<typeof GameSummaryPlayer>
export const GameSummaryPlayer = z.object({
  id: z.number(),
  alias: z.string().nullable(),
}) satisfies z.ZodType<GameSummaryPlayerRow>

export type GameSummary = z.infer<typeof GameSummary>
export const GameSummary = z.object({
  name: z.string(),
  id: z.number(),
  maxPlayerCount: z.number(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameSummaryPlayer,
  players: z.array(GameSummaryPlayer),
}) satisfies z.ZodType<GameSummaryRow>
