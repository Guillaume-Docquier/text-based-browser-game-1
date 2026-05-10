import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import type {
  WorldMapBodyDetails,
  WorldMapBodySelector,
  WorldMapsRepository,
  WorldMapSectorDetails,
  WorldMapSectorSelector,
  WorldMapSystem,
} from "#lib/db/worldMaps.repository.ts"

export const WorldMapsControllerFailure = {
  GAME_NOT_FOUND: "Game does not exist.",
  PLAYER_NOT_IN_GAME: "Player is not in this game.",
  WORLD_MAP_NOT_FOUND: "World map does not exist.",
  SECTOR_NOT_FOUND: "Sector does not exist.",
  BODY_NOT_FOUND: "Body does not exist.",
} as const

export class WorldMapsController {
  private readonly gamesRepository: GamesRepository
  private readonly worldMapsRepository: WorldMapsRepository
  private readonly logger: Logger

  public constructor({
    gamesRepository,
    worldMapsRepository,
    logger,
  }: {
    gamesRepository: GamesRepository
    worldMapsRepository: WorldMapsRepository
    logger: Logger
  }) {
    this.gamesRepository = gamesRepository
    this.worldMapsRepository = worldMapsRepository
    this.logger = logger.child({ scope: "world-maps-controller" })
  }

  public async getSystem({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<WorldMapSystem, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    const getSystemResult = await this.worldMapsRepository.getSystem({ gameId })
    if (Result.isFailure(getSystemResult)) {
      return getSystemResult
    }

    const system = getSystemResult.value
    if (system === undefined) {
      return Result.Failure(WorldMapsControllerFailure.WORLD_MAP_NOT_FOUND)
    }

    return Result.Success(system)
  }

  public async getSector({
    gameId,
    playerId,
    selector,
  }: {
    gameId: number
    playerId: number
    selector: WorldMapSectorSelector
  }): Promise<Result<WorldMapSectorDetails, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    const getSectorResult = await this.worldMapsRepository.getSector({ gameId, selector })
    if (Result.isFailure(getSectorResult)) {
      return getSectorResult
    }

    if (getSectorResult.value.status === "missing-map") {
      return Result.Failure(WorldMapsControllerFailure.WORLD_MAP_NOT_FOUND)
    }

    if (getSectorResult.value.status === "missing-sector") {
      return Result.Failure(WorldMapsControllerFailure.SECTOR_NOT_FOUND)
    }

    return Result.Success(getSectorResult.value.sector)
  }

  public async getBody({
    gameId,
    playerId,
    selector,
  }: {
    gameId: number
    playerId: number
    selector: WorldMapBodySelector
  }): Promise<Result<WorldMapBodyDetails, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    const getBodyResult = await this.worldMapsRepository.getBody({ gameId, selector })
    if (Result.isFailure(getBodyResult)) {
      return getBodyResult
    }

    if (getBodyResult.value.status === "missing-map") {
      return Result.Failure(WorldMapsControllerFailure.WORLD_MAP_NOT_FOUND)
    }

    if (getBodyResult.value.status === "missing-body") {
      return Result.Failure(WorldMapsControllerFailure.BODY_NOT_FOUND)
    }

    return Result.Success(getBodyResult.value.body)
  }

  private async canReadGame({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<true, string>> {
    const hasPlayerJoinedGameResult = await this.gamesRepository.hasPlayerJoinedGame({ gameId, playerId })
    if (Result.isFailure(hasPlayerJoinedGameResult)) {
      return hasPlayerJoinedGameResult
    }

    if (hasPlayerJoinedGameResult.value === undefined) {
      this.logger.info("Player cannot read world map because game does not exist", { gameId, playerId })
      return Result.Failure(WorldMapsControllerFailure.GAME_NOT_FOUND)
    }

    if (!hasPlayerJoinedGameResult.value) {
      this.logger.info("Player cannot read world map because player is not in game", { gameId, playerId })
      return Result.Failure(WorldMapsControllerFailure.PLAYER_NOT_IN_GAME)
    }

    return Result.Success(true)
  }
}
