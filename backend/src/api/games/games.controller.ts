import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow, GameRowInsert } from "#lib/db/games/games.repository.ts"
import type { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  type StarSystemGenerationSettings,
  StarSystemGenerationSettingsInput,
  type StarSystemGenerationSettingsInput as StarSystemGenerationSettingsInputType,
  type StarSystemsRepository,
} from "#lib/db/star-systems/starSystems.repository.ts"
import { generateStarSystem } from "#lib/star-systems/generateStarSystem.ts"
import { randomInt } from "node:crypto"
import z from "zod"

export class GamesController {
  private readonly gamesRepository: GamesRepository
  private readonly starSystemsRepository: StarSystemsRepository
  private readonly db: PostgresRepository["db"]
  private readonly logger: Logger

  public constructor({
    gamesRepository,
    starSystemsRepository,
    db,
    logger,
  }: {
    gamesRepository: GamesRepository
    starSystemsRepository: StarSystemsRepository
    db: PostgresRepository["db"]
    logger: Logger
  }) {
    this.gamesRepository = gamesRepository
    this.starSystemsRepository = starSystemsRepository
    this.db = db
    this.logger = logger.child({ scope: "games-controller" })
  }

  public async create(newGame: CreateGameCommand): Promise<Result<CreatedGame, string>> {
    const generationSettings = normalizeGenerationSettings(newGame.starSystemGenerationSettings)
    const createResult = await Result.tryCatch(
      async () =>
        await this.db.transaction(async (tx): Promise<CreatedGame> => {
          const gameCreateResult = await this.gamesRepository.create(
            {
              name: newGame.name,
              createdByPlayerId: newGame.createdByPlayerId,
              nbSeats: newGame.nbSeats,
              tickIntervalSeconds: newGame.tickIntervalSeconds,
            },
            tx,
          )

          if (Result.isFailure(gameCreateResult)) {
            throw new Error(gameCreateResult.error)
          }

          const starSystemResult = generateStarSystem({ gameId: gameCreateResult.value.id, generationSettings })
          if (Result.isFailure(starSystemResult)) {
            throw new Error(starSystemResult.error)
          }

          const createStarSystemResult = await this.starSystemsRepository.create(starSystemResult.value, tx)
          if (Result.isFailure(createStarSystemResult)) {
            throw new Error(createStarSystemResult.error)
          }

          return gameCreateResult.value
        }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game and Star System", { newGame, error: createResult.error })
      return Result.Failure(String(createResult.error))
    }

    return createResult
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

export type CreateGameCommand = z.infer<typeof CreateGameCommand>
export const CreateGameCommand = GameInsert.extend({
  starSystemGenerationSettings: StarSystemGenerationSettingsInput,
})

export type CreatedGame = z.infer<typeof CreatedGame>
export const CreatedGame = z.object({
  name: z.string(),
  id: z.number(),
  createdByPlayerId: z.number(),
  winnerPlayerId: z.number().nullable(),
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
}) satisfies z.ZodType<GameRow>

export const GameSummaryStatus = {
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
  winnerPlayerId: z.number().nullable(),
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

function normalizeGenerationSettings(settings: StarSystemGenerationSettingsInputType): StarSystemGenerationSettings {
  return {
    ...settings,
    seed: settings.seed ?? randomUnsigned32BitInteger(),
  }
}

function randomUnsigned32BitInteger(): number {
  return randomInt(0, 4_294_967_296)
}
