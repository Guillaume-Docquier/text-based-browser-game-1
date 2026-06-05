import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameSummaryModel, GamesRepository } from "#lib/db/games/games.repository.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/createDefaultStarSystemGenerationSettings.ts"
import { couldNot } from "#lib/errors.ts"
import { RangeDto } from "#api/RangeDto.ts"
import z from "zod"

export class GamesController {
  private readonly gamesRepository: GamesRepository
  private readonly logger: Logger

  public constructor({ gamesRepository, logger }: { gamesRepository: GamesRepository; logger: Logger }) {
    this.gamesRepository = gamesRepository
    this.logger = logger.child({ scope: "games-controller" })
  }

  public async create(newGame: NewGameDto): Promise<Result<CreatedGameDto, string>> {
    const createGameResult = await this.gamesRepository.create({
      createdByPlayerId: newGame.createdByPlayerId,
      settings: {
        ...newGame.settings,
        starSystemGenerationSettings: createDefaultStarSystemGenerationSettings(),
      },
    })
    if (Result.isFailure(createGameResult)) {
      this.logger.error("Could not create game", { newGame, error: createGameResult.error })
      return Result.Failure(couldNot("create game"))
    }

    return createGameResult
  }

  public async getSummaries({ playerId }: { playerId: number | undefined }): Promise<GameSummaryDto[]> {
    const getSummariesResult = await this.gamesRepository.getSummaries()
    if (Result.isFailure(getSummariesResult)) {
      this.logger.error("Could not get game summaries, returning empty array", { playerId, error: getSummariesResult.error })
      return []
    }

    return getSummariesResult.value.map((gameSummaryModel) => toGameSummaryDto({ gameSummaryModel, playerId }))
  }

  public async getSummaryById({ gameId, playerId }: { gameId: number; playerId: number | undefined }): Promise<GameSummaryDto | undefined> {
    const getSummaryResult = await this.gamesRepository.getSummaryById({ gameId })
    if (Result.isFailure(getSummaryResult)) {
      this.logger.error("Could not get game summary, returning undefined", { gameId, playerId, error: getSummaryResult.error })
      return undefined
    }

    const gameSummaryModel = getSummaryResult.value
    if (gameSummaryModel === undefined) {
      return undefined
    }

    return toGameSummaryDto({ gameSummaryModel, playerId })
  }

  public async join({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummaryDto, string>> {
    const gameJoinResult = await this.gamesRepository.join({
      gameId,
      playerId,
      canJoin: (gameSummaryModel) => toGameSummaryDto({ gameSummaryModel, playerId }).canJoin,
    })

    if (Result.isFailure(gameJoinResult)) {
      return gameJoinResult
    }

    const gameSummary = await this.getSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async leave({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummaryDto, string>> {
    const gameLeaveResult = await this.gamesRepository.leave({
      gameId,
      playerId,
      canLeave: (gameSummaryModel) => toGameSummaryDto({ gameSummaryModel, playerId }).canLeave,
    })

    if (Result.isFailure(gameLeaveResult)) {
      return gameLeaveResult
    }

    const gameSummary = await this.getSummaryById({ gameId, playerId })
    Assert.isDefined(gameSummary)

    return Result.Success(gameSummary)
  }

  public async start({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<GameSummaryDto, string>> {
    const gameStartResult = await this.gamesRepository.start({
      gameId,
      canStart: (gameSummaryModel) => toGameSummaryDto({ gameSummaryModel, playerId }).canStart,
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

function toGameSummaryDto({
  gameSummaryModel,
  playerId,
}: {
  gameSummaryModel: GameSummaryModel
  playerId: number | undefined
}): GameSummaryDto {
  // prettier-ignore
  const status =
    gameSummaryModel.endedAt !== null ? GameSummaryStatus.ENDED
    : gameSummaryModel.startedAt !== null ? GameSummaryStatus.STARTED
    : gameSummaryModel.players.length >= gameSummaryModel.settings.nbSeats ? GameSummaryStatus.READY_TO_START
    : GameSummaryStatus.WAITING_FOR_PLAYERS

  const canJoin =
    playerId !== undefined &&
    status === GameSummaryStatus.WAITING_FOR_PLAYERS &&
    gameSummaryModel.players.every((player) => player.id !== playerId)

  const canLeave =
    playerId !== undefined &&
    // status < GameSummaryStatus.STARTED would be more future proof
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryModel.creator.id !== playerId &&
    gameSummaryModel.players.some((player) => player.id === playerId)

  const canStart =
    playerId !== undefined &&
    (status === GameSummaryStatus.WAITING_FOR_PLAYERS || status === GameSummaryStatus.READY_TO_START) &&
    gameSummaryModel.creator.id === playerId

  return {
    ...gameSummaryModel,
    status,
    canJoin,
    canLeave,
    canStart,
  }
}

export type NewGameDto = z.infer<typeof NewGameDto>
export const NewGameDto = z.object({
  createdByPlayerId: z.number(),
  settings: z.object({
    name: z.string(),
    nbSeats: z.number(),
    tickIntervalSeconds: z.number(),
  }),
})

export type StarSystemGenerationSettingsDto = z.infer<typeof StarSystemGenerationSettingsDto>
export const StarSystemGenerationSettingsDto = z.object({
  planetDensity: RangeDto,
  nbPlanets: RangeDto,
  nbMoonsPerPlanet: RangeDto,
  nbAsteroidBelts: RangeDto,
  nbAsteroidsPerSector: RangeDto,
  seed: z.number(),
})

export type GameSettingsDto = z.infer<typeof GameSettingsDto>
export const GameSettingsDto = z.object({
  name: z.string(),
  locked: z.boolean(),
  starSystemGenerationSettings: StarSystemGenerationSettingsDto,
  nbSeats: z.number(),
  tickIntervalSeconds: z.number(),
})

export type CreatedGameDto = z.infer<typeof CreatedGameDto>
export const CreatedGameDto = z.object({
  id: z.number(),
  createdByPlayerId: z.number(),
  winnerPlayerId: z.number().nullable(),
  settings: GameSettingsDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})

export const GameSummaryStatus = {
  WAITING_FOR_PLAYERS: "WAITING_FOR_PLAYERS",
  READY_TO_START: "READY_TO_START",
  STARTED: "STARTED",
  ENDED: "ENDED",
} as const

export type GameSummaryPlayerDto = z.infer<typeof GameSummaryPlayerDto>
export const GameSummaryPlayerDto = z.object({
  id: z.number(),
  alias: z.string().nullable(),
})

export type GameSummaryDto = z.infer<typeof GameSummaryDto>
export const GameSummaryDto = z.object({
  id: z.number(),
  winnerPlayerId: z.number().nullable(),
  settings: GameSettingsDto,
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  creator: GameSummaryPlayerDto,
  players: z.array(GameSummaryPlayerDto),
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
})
