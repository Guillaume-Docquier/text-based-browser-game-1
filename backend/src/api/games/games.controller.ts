import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow } from "#lib/db/games/games.repository.ts"
import z from "zod"
import type { StarSystemsRepository, StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"
import { generateStarSystem, MAX_ORBITS } from "#lib/star-systems/generateStarSystem.ts"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

export class GamesController {
  private readonly gamesRepository: GamesRepository
  private readonly starSystemsRepository: StarSystemsRepository
  private readonly createTransaction: NodePgDatabase["transaction"]
  private readonly logger: Logger

  public constructor({
    gamesRepository,
    starSystemsRepository,
    createTransaction,
    logger,
  }: {
    gamesRepository: GamesRepository
    starSystemsRepository: StarSystemsRepository
    createTransaction: NodePgDatabase["transaction"]
    logger: Logger
  }) {
    this.gamesRepository = gamesRepository
    this.starSystemsRepository = starSystemsRepository
    this.createTransaction = createTransaction
    this.logger = logger.child({ scope: "games-controller" })
  }

  public async create(newGame: NewGameDto): Promise<Result<CreatedGame, string>> {
    const generationSettingsResult = normalizeStarSystemGenerationSettings(newGame.starSystemGenerationSettings)
    if (Result.isFailure(generationSettingsResult)) {
      this.logger.error("Invalid Star System generation settings", { newGame, error: generationSettingsResult.error })
      return Result.Failure(generationSettingsResult.error)
    }

    const generationSettings = generationSettingsResult.value
    const { starSystemGenerationSettings: _starSystemGenerationSettings, ...gameInsert } = newGame

    const createResult = await Result.tryCatch(
      async () =>
        await this.createTransaction(async (tx) => {
          const createGameResult = await this.gamesRepository.create(gameInsert, tx)
          if (Result.isFailure(createGameResult)) {
            this.logger.error("Could not create game during game creation transaction", { newGame, error: createGameResult.error })
            tx.rollback()
            throw new Error(createGameResult.error)
          }

          const game = createGameResult.value
          const starSystemResult = generateStarSystem({ gameId: game.id, generationSettings })
          if (Result.isFailure(starSystemResult)) {
            this.logger.error("Could not generate Star System during game creation transaction", { newGame, error: starSystemResult.error })
            tx.rollback()
            throw new Error(starSystemResult.error)
          }

          const createStarSystemResult = await this.starSystemsRepository.create(starSystemResult.value, tx)
          if (Result.isFailure(createStarSystemResult)) {
            this.logger.error("Could not create Star System during game creation transaction", {
              newGame,
              error: createStarSystemResult.error,
            })
            tx.rollback()
            throw new Error(createStarSystemResult.error)
          }

          return game
        }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game with Star System", { newGame, error: createResult.error })
      return Result.Failure("Game could not be created")
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

const RangeDto = z.object({
  min: z.number(),
  max: z.number(),
})

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
export const StarSystemGenerationSettingsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: z.number().optional(),
})

export type NewGameDto = z.infer<typeof NewGameDto>
export const NewGameDto = z.object({
  name: z.string(),
  createdByPlayerId: z.number(),
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
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

function normalizeStarSystemGenerationSettings(
  generationSettings: StarSystemGenerationSettingsDto,
): Result<StarSystemGenerationSettings, string> {
  const seed = generationSettings.seed ?? Math.floor(Math.random() * 4_294_967_296)

  const normalizedSettings = {
    ...generationSettings,
    seed,
  } satisfies StarSystemGenerationSettings

  const ranges = [
    normalizedSettings.planetDensity,
    normalizedSettings.nbPlanets,
    normalizedSettings.nbMoonsPerPlanet,
    normalizedSettings.nbAsteroidBelts,
    normalizedSettings.nbAsteroidsPerSector,
  ]

  if (!ranges.every(({ min, max }) => Number.isFinite(min) && Number.isFinite(max))) {
    return Result.Failure("Star System generation ranges must be finite numbers")
  }

  if (!ranges.every(({ min, max }) => min <= max)) {
    return Result.Failure("Star System generation range minimums must be less than or equal to maximums")
  }

  if (normalizedSettings.planetDensity.min < 0 || normalizedSettings.planetDensity.max > 1) {
    return Result.Failure("Planet density must stay between 0 and 1")
  }

  const integerRanges = [
    normalizedSettings.nbPlanets,
    normalizedSettings.nbMoonsPerPlanet,
    normalizedSettings.nbAsteroidBelts,
    normalizedSettings.nbAsteroidsPerSector,
  ]

  if (!integerRanges.every(({ min, max }) => Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= 0)) {
    return Result.Failure("Star System integer generation ranges must contain non-negative integers")
  }

  if (normalizedSettings.nbAsteroidBelts.max > MAX_ORBITS) {
    return Result.Failure(`Star System generation supports at most ${MAX_ORBITS} Asteroid belts`)
  }

  if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    return Result.Failure("Star System generation seed must be an unsigned 32-bit integer")
  }

  return Result.Success(normalizedSettings)
}
