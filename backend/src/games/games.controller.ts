import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow, GameRowInsert } from "./games.repository.ts"
import z from "zod"

export class GamesController {
  private readonly gamesRepository: GamesRepository

  public constructor({ gamesRepository }: { gamesRepository: GamesRepository }) {
    this.gamesRepository = gamesRepository
  }

  public async create(newGame: GameInsert): Promise<CreatedGame> {
    return await this.gamesRepository.create(newGame)
  }

  public async getSummaries(): Promise<GameSummary[]> {
    return (await this.gamesRepository.getSummaries()).map(toGameSummary)
  }

  public async getSummaryById({ gameId }: { gameId: number }): Promise<GameSummary | undefined> {
    const gameSummaryRow = await this.gamesRepository.getSummaryById({ gameId })
    if (gameSummaryRow === undefined) {
      return undefined
    }

    return toGameSummary(gameSummaryRow)
  }
}

// Maybe this should go into the repository. I don't know yet.
function toGameSummary(gameSummaryRow: GameSummaryRow): GameSummary {
  return {
    ...gameSummaryRow,
    status:
      gameSummaryRow.endedAt !== null
        ? GameSummaryStatus.ENDED
        : gameSummaryRow.startedAt !== null
          ? GameSummaryStatus.STARTED
          : gameSummaryRow.players.length <= gameSummaryRow.maxPlayerCount
            ? GameSummaryStatus.READY_TO_START
            : GameSummaryStatus.WAITING_FOR_PLAYERS,
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

const GameSummaryStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  STARTED: "STARTED",
  ENDED: "ENDED",
} as const

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
  status: z.enum(GameSummaryStatus),
}) satisfies z.ZodType<GameSummaryRow>
