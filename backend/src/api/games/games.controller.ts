import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryPlayerRow, GameSummaryRow, GamesRepository, GameRow, GameRowInsert } from "#lib/db/games/games.repository.ts"
import z from "zod"
import { randomInt } from "node:crypto"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { StarSystemGenerationSettings, StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import type { IntegerRange, PercentageRange } from "#lib/Range.ts"
import { generateStarSystem, MAX_ORBITS } from "#lib/star-systems/generateStarSystem.ts"
import { couldNot } from "#lib/errors.ts"

export class GamesController {
  private readonly gamesRepository: GamesRepository
  private readonly starSystemsRepository: StarSystemsRepository
  private readonly createTransaction: CreateTransaction
  private readonly logger: Logger

  public constructor({
    gamesRepository,
    starSystemsRepository,
    createTransaction,
    logger,
  }: {
    gamesRepository: GamesRepository
    starSystemsRepository: StarSystemsRepository
    createTransaction: CreateTransaction
    logger: Logger
  }) {
    this.gamesRepository = gamesRepository
    this.starSystemsRepository = starSystemsRepository
    this.createTransaction = createTransaction
    this.logger = logger.child({ scope: "games-controller" })
  }

  public async create(newGame: GameInsert): Promise<Result<CreatedGame, string>> {
    const generationSettingsResult = starSystemGenerationSettingsFromDto(newGame.starSystemGenerationSettings)
    if (Result.isFailure(generationSettingsResult)) {
      this.logger.error("Invalid Star System generation settings", {
        settings: newGame.starSystemGenerationSettings,
        error: generationSettingsResult.error,
      })
      return Result.Failure(generationSettingsResult.error)
    }

    const createResult = await Result.tryCatch(
      this.createTransaction(async (tx) => {
        const gameResult = await this.gamesRepository.create(toGameRowInsert(newGame), tx)
        if (Result.isFailure(gameResult)) {
          throw new Error(gameResult.error) // I would use tx.rollback(), but TS doesn't know that it throws and breaks the Result control flow semantics
        }

        const starSystem = generateStarSystem(generationSettingsResult.value)
        const createStarSystemResult = await this.starSystemsRepository.create({ gameId: gameResult.value.id, ...starSystem }, tx)
        if (Result.isFailure(createStarSystemResult)) {
          throw new Error(createStarSystemResult.error) // I would use tx.rollback(), but TS doesn't know that it throws and breaks the Result control flow semantics
        }

        return {
          ...gameResult.value,
          starSystemGenerationSettings: starSystem.starSystemGenerationSettings,
        }
      }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game", { newGame, error: createResult.error })
      return Result.Failure(couldNot("create game"))
    }

    return createResult
  }

  public async getSummaries({ playerId }: { playerId: number | undefined }): Promise<GameSummary[]> {
    const getSummariesResult = await this.gamesRepository.getSummaries()
    if (Result.isFailure(getSummariesResult)) {
      this.logger.error("Could not get game summaries, returning empty array", { playerId, error: getSummariesResult.error })
      return []
    }

    const getGenerationSettingsResult = await this.starSystemsRepository.getGenerationSettingsByGameIds({
      gameIds: getSummariesResult.value.map((summary) => summary.id),
    })
    const generationSettingsByGameId = Result.isFailure(getGenerationSettingsResult)
      ? new Map<number, StarSystemGenerationSettings>()
      : new Map(getGenerationSettingsResult.value.map((generationSettings) => [generationSettings.gameId, generationSettings]))

    return getSummariesResult.value.map((gameSummaryRow) =>
      toGameSummary({
        gameSummaryRow,
        starSystemGenerationSettings: generationSettingsByGameId.get(gameSummaryRow.id),
        playerId,
      }),
    )
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

    const getGenerationSettingsResult = await this.starSystemsRepository.getGenerationSettingsByGameId({ gameId: gameSummaryRow.id })
    const generationSettings = Result.isFailure(getGenerationSettingsResult) ? undefined : getGenerationSettingsResult.value

    return toGameSummary({ gameSummaryRow, starSystemGenerationSettings: generationSettings, playerId })
  }

  public async join({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummary, string>> {
    const gameJoinResult = await this.gamesRepository.join({
      gameId,
      playerId,
      canJoin: (gameSummaryRow) => computeGameStatus({ gameSummaryRow, playerId }).canJoin,
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
      canLeave: (gameSummaryRow) => computeGameStatus({ gameSummaryRow, playerId }).canLeave,
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
      canStart: (gameSummaryRow) => computeGameStatus({ gameSummaryRow, playerId }).canStart,
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

function computeGameStatus({
  gameSummaryRow,
  playerId,
}: {
  gameSummaryRow: GameSummaryRow
  playerId: number | undefined
}): Pick<GameSummary, "status" | "canJoin" | "canLeave" | "canStart"> {
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

  return { status, canJoin, canLeave, canStart }
}

function toGameSummary({
  gameSummaryRow,
  starSystemGenerationSettings,
  playerId,
}: {
  gameSummaryRow: GameSummaryRow
  /**
   *  Can be undefined for convenience because the DB query doesn't enforce this that a game always has a star system, but in reality there should always be.
   *  ...now that I think about this, maybe this data should live in the games table, not the star systems table.
   */
  starSystemGenerationSettings: StarSystemGenerationSettings | undefined
  playerId: number | undefined
}): GameSummary {
  Assert.isDefined(starSystemGenerationSettings)

  return {
    ...gameSummaryRow,
    ...computeGameStatus({ gameSummaryRow, playerId }),
    starSystemGenerationSettings,
  }
}

const RangeDto = z.object({
  min: z.number(),
  max: z.number(),
})

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
const StarSystemGenerationSettingsDto = z.object({
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
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
})

export type GameInsert = NewGameDto & Pick<GameRowInsert, "createdByPlayerId">

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
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
}) satisfies z.ZodType<GameRow>

function toGameRowInsert(newGame: GameInsert): GameRowInsert {
  return {
    name: newGame.name,
    createdByPlayerId: newGame.createdByPlayerId,
    nbSeats: newGame.nbSeats,
    tickIntervalSeconds: newGame.tickIntervalSeconds,
  }
}

function starSystemGenerationSettingsFromDto(
  settings: NewGameDto["starSystemGenerationSettings"],
): Result<StarSystemGenerationSettings, string> {
  const rangesResult = validateStarSystemGenerationSettings(settings)
  if (Result.isFailure(rangesResult)) {
    return rangesResult
  }

  return Result.Success({
    ...settings,
    seed: settings.seed ?? randomInt(0, 2 ** 32),
  })
}

function validateStarSystemGenerationSettings(settings: NewGameDto["starSystemGenerationSettings"]): Result<true, string> {
  const rangeChecks: Array<[string, PercentageRange | IntegerRange]> = [
    ["planetDensity", settings.planetDensity],
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ]

  for (const [rangeName, range] of rangeChecks) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      return Result.Failure(`${rangeName} must have finite bounds`)
    }

    if (range.min > range.max) {
      return Result.Failure(`${rangeName} min must be less than or equal to max`)
    }
  }

  if (settings.planetDensity.min < 0 || settings.planetDensity.max > 1) {
    return Result.Failure("planetDensity must stay between 0 and 1")
  }

  const integerRanges: Array<[string, IntegerRange]> = [
    ["nbPlanets", settings.nbPlanets],
    ["nbMoonsPerPlanet", settings.nbMoonsPerPlanet],
    ["nbAsteroidBelts", settings.nbAsteroidBelts],
    ["nbAsteroidsPerSector", settings.nbAsteroidsPerSector],
  ]

  for (const [rangeName, range] of integerRanges) {
    if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) {
      return Result.Failure(`${rangeName} must use integer bounds`)
    }

    if (range.min < 0) {
      return Result.Failure(`${rangeName} must be greater than or equal to 0`)
    }
  }

  if (settings.seed !== undefined && (!Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 2 ** 32 - 1)) {
    return Result.Failure("seed must be an unsigned 32-bit integer")
  }

  if (settings.nbAsteroidBelts.max > MAX_ORBITS) {
    return Result.Failure(`nbAsteroidBelts cannot be greater than ${MAX_ORBITS}`)
  }

  const maxNonBeltSectorCount = Array.from({ length: MAX_ORBITS }, (_, index) => 2 ** (index + 1))
    .toSorted((sectorCountA, sectorCountB) => sectorCountB - sectorCountA)
    .slice(0, MAX_ORBITS - settings.nbAsteroidBelts.max)
    .reduce((total, sectorCount) => total + sectorCount, 0)
  const maxPlanetCapacity = Math.floor(maxNonBeltSectorCount * settings.planetDensity.min)

  if (maxPlanetCapacity < settings.nbPlanets.max) {
    return Result.Failure(`settings cannot generate the requested Planets within ${MAX_ORBITS} orbits`)
  }

  return Result.Success(true)
}

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
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
}) satisfies z.ZodType<GameSummaryRow>
