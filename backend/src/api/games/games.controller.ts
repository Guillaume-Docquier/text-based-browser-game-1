import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow, GameRowInsert } from "#lib/db/games.repository.ts"
import z from "zod"

export class GamesController {
  private readonly gamesRepository: GamesRepository
  private readonly logger: Logger

  public constructor({ gamesRepository, logger }: { gamesRepository: GamesRepository; logger: Logger }) {
    this.gamesRepository = gamesRepository
    this.logger = logger.child({ scope: "games-controller" })
  }

  public async create(newGame: GameInsert): Promise<Result<CreatedGame, string>> {
    return await this.gamesRepository.create(newGame)
  }

  public async getSummaries({ playerId }: { playerId: number | undefined }): Promise<GameSummary[]> {
    const getSummariesResult = await this.gamesRepository.getSummaries()
    if (Result.isFailure(getSummariesResult)) {
      this.logger.error("Could not get game summaries, returning empty array", { playerId, error: getSummariesResult.error })
      return []
    }

    return getSummariesResult.value.map((gameSummaryRow) => toGameSummary({ gameSummaryRow, playerId }))
  }

  public async getSummaryById({ gameId, playerId }: { gameId: number; playerId: number | undefined }): Promise<GameSummary | undefined> {
    const getSummaryResult = await this.gamesRepository.getSummaryById({ gameId })
    if (Result.isFailure(getSummaryResult)) {
      this.logger.error("Could not get game summary, returning undefined", { gameId, playerId, error: getSummaryResult.error })
      return undefined
    }

    const gameSummaryRow = getSummaryResult.value
    if (gameSummaryRow === undefined) {
      return undefined
    }

    return toGameSummary({ gameSummaryRow, playerId })
  }

  public async join({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummary, string>> {
    const gameJoinResult = await this.gamesRepository.join({
      gameId,
      playerId,
      canJoin: (gameSummaryRow) => toGameSummary({ gameSummaryRow, playerId }).canJoin,
    })

    if (Result.isFailure(gameJoinResult)) {
      return gameJoinResult
    }

    const gameSummary = await this.getSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async leave({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummary, string>> {
    const gameLeaveResult = await this.gamesRepository.leave({
      gameId,
      playerId,
      canLeave: (gameSummaryRow) => toGameSummary({ gameSummaryRow, playerId }).canLeave,
    })

    if (Result.isFailure(gameLeaveResult)) {
      return gameLeaveResult
    }

    const gameSummary = await this.getSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async start({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummary, string>> {
    const gameStartResult = await this.gamesRepository.start({
      gameId,
      canStart: (gameSummaryRow) => toGameSummary({ gameSummaryRow, playerId }).canStart,
    })

    if (Result.isFailure(gameStartResult)) {
      this.logger.error("Failed to start game", { gameId, playerId, error: gameStartResult.error })
      return gameStartResult
    }

    const gameSummary = await this.getSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }
}

function toGameSummary({ gameSummaryRow, playerId }: { gameSummaryRow: GameSummaryRow; playerId: number | undefined }): GameSummary {
  // prettier-ignore
  const status =
    gameSummaryRow.endedAt !== null ? GameSummaryStatus.ENDED
    : gameSummaryRow.startedAt !== null ? GameSummaryStatus.STARTED
    : gameSummaryRow.players.length >= gameSummaryRow.nbSeats ? GameSummaryStatus.READY_TO_START
    : GameSummaryStatus.WAITING_FOR_PLAYERS

  const canJoin =
    playerId !== undefined &&
    status === GameSummaryStatus.WAITING_FOR_PLAYERS &&
    gameSummaryRow.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryRow.creator.id !== playerId &&
    gameSummaryRow.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryRow.creator.id === playerId

  return {
    ...gameSummaryRow,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

export type GameInsert = z.infer<typeof GameInsert>
export const GameInsert = z.object({
  name: z.string(),
  createdByPlayerId: z.number(),
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
}) satisfies z.ZodType<GameRowInsert>

export type CreatedGame = z.infer<typeof CreatedGame>
export const CreatedGame = z.object({
  name: z.string(),
  id: z.number(),
  createdByPlayerId: z.number(),
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
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
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameSummaryPlayer,
  players: z.array(GameSummaryPlayer),
  status: z.enum(GameSummaryStatus),
  /**
   * Whether the current player can join the game.
   */
  canJoin: z.boolean(),
  /**
   * Whether the current player can leave the game.
   */
  canLeave: z.boolean(),
  /**
   * Whether the current player can start the game.
   */
  canStart: z.boolean(),
}) satisfies z.ZodType<GameSummaryRow>
