import { type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import { BodyType } from "#lib/db/schema.ts"
import type {
  MapGenerationSettingsReadModel as MapGenerationSettingsReadModelType,
  MapGenerationSettingsWriteModel as MapGenerationSettingsWriteModelType,
  BodyDetailsReadModel as WorldMapBodyDetailsReadModelType,
  BodyReadModel as WorldMapBodyReadModelType,
  BodyWriteModel as WorldMapBodyWriteModelType,
  MovementEdgeReadModel as WorldMapMovementEdgeReadModelType,
  MovementEdgeWriteModel as WorldMapMovementEdgeWriteModelType,
  MovementGraphReadModel as WorldMapMovementGraphReadModelType,
  OrbitReadModel as WorldMapOrbitReadModelType,
  OrbitWriteModel as WorldMapOrbitWriteModelType,
  WorldMapsRepository,
  SectorDetailsReadModel as WorldMapSectorDetailsReadModelType,
  SectorReadModel as WorldMapSectorReadModelType,
  SectorWriteModel as WorldMapSectorWriteModelType,
  StarSystemReadModel as WorldMapSystemReadModelType,
  StarSystemWriteModel as WorldMapSystemWriteModelType,
} from "#lib/db/worldMaps.repository.ts"
import z from "zod"
import type { IntegerRange, IntegerRange as MapGenerationRangeWriteModelType } from "#lib/Range.ts"

export const WorldMapsControllerFailure = {
  GAME_NOT_FOUND: "Game does not exist.",
  PLAYER_NOT_IN_GAME: "Player is not in this game.",
  WORLD_MAP_NOT_FOUND: "World map does not exist.",
  SECTOR_NOT_FOUND: "Sector does not exist.",
  BODY_NOT_FOUND: "Body does not exist.",
} as const

export const MapGenerationRangeWriteModel = z.object({ min: z.number(), max: z.number() }).refine(({ min, max }) => min <= max, {
  message: "Range min must be lower than or equal to max.",
}) satisfies z.ZodType<MapGenerationRangeWriteModelType>

export const MapGenerationIntegerRangeWriteModel = z
  .object({ min: z.number().int(), max: z.number().int() })
  .refine(({ min, max }) => min <= max, {
    message: "Range min must be lower than or equal to max.",
  }) satisfies z.ZodType<IntegerRange>

export const MapGenerationRangeReadModel = MapGenerationIntegerRangeWriteModel
export const MapGenerationIntegerRangeReadModel = MapGenerationIntegerRangeWriteModel

export const MapGenerationSettingsWriteModel = z.object({
  planetDensityOfSystem: MapGenerationRangeWriteModel.refine(({ min, max }) => min >= 0 && max <= 1, {
    message: "Planet density must be between 0 and 1.",
  }),
  nbPlanets: MapGenerationIntegerRangeWriteModel,
  nbMoonsPerPlanet: MapGenerationIntegerRangeWriteModel,
  nbAsteroidBelts: MapGenerationIntegerRangeWriteModel,
  nbAsteroidsPerSector: MapGenerationIntegerRangeWriteModel,
  seed: z.number(),
}) satisfies z.ZodType<MapGenerationSettingsWriteModelType>

export const MapGenerationSettingsReadModel: z.ZodType<MapGenerationSettingsReadModelType> = MapGenerationSettingsWriteModel

const BodyTypeReadModel = z.enum(BodyType)

export const WorldMapMovementEdgeReadModel = z.object({
  from: z.number(),
  to: z.number(),
  weight: z.number(),
}) satisfies z.ZodType<WorldMapMovementEdgeReadModelType>

export const WorldMapMovementGraphReadModel = z.object({
  edges: z.record(z.string(), z.array(WorldMapMovementEdgeReadModel)),
}) satisfies z.ZodType<WorldMapMovementGraphReadModelType>

export const WorldMapBodyReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: BodyTypeReadModel,
  movementNodeId: z.number(),
}) satisfies z.ZodType<WorldMapBodyReadModelType>

export const WorldMapSectorReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  bodies: z.array(WorldMapBodyReadModel),
  movementNodeId: z.number(),
}) satisfies z.ZodType<WorldMapSectorReadModelType>

export const WorldMapSectorDetailsReadModel = WorldMapSectorReadModel.extend({
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<WorldMapSectorDetailsReadModelType>

export const WorldMapBodyDetailsReadModel = WorldMapBodyReadModel.extend({
  orbitId: z.number(),
  orbitNumber: z.number(),
  orbitCoordinates: z.string(),
  sectorId: z.number(),
  sectorNumber: z.number(),
  sectorCoordinates: z.string(),
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<WorldMapBodyDetailsReadModelType>

export const WorldMapOrbitReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(WorldMapSectorReadModel),
}) satisfies z.ZodType<WorldMapOrbitReadModelType>

export const WorldMapSystemReadModel = z.object({
  gameId: z.number(),
  generationSettings: MapGenerationSettingsReadModel,
  orbits: z.array(WorldMapOrbitReadModel),
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<WorldMapSystemReadModelType>

export const WorldMapMovementEdgeWriteModel = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().optional(),
}) satisfies z.ZodType<WorldMapMovementEdgeWriteModelType>

export const WorldMapBodyWriteModel = z.object({
  number: z.number(),
  type: BodyTypeReadModel,
  name: z.string(),
  movementNodeKey: z.string(),
}) satisfies z.ZodType<WorldMapBodyWriteModelType>

export const WorldMapSectorWriteModel = z.object({
  number: z.number(),
  movementNodeKey: z.string(),
  bodies: z.array(WorldMapBodyWriteModel),
}) satisfies z.ZodType<WorldMapSectorWriteModelType>

export const WorldMapOrbitWriteModel = z.object({
  number: z.number(),
  sectors: z.array(WorldMapSectorWriteModel),
}) satisfies z.ZodType<WorldMapOrbitWriteModelType>

export const WorldMapSystemWriteModel = z.object({
  gameId: z.number(),
  generationSettings: MapGenerationSettingsWriteModel,
  orbits: z.array(WorldMapOrbitWriteModel),
  movementEdges: z.array(WorldMapMovementEdgeWriteModel),
}) satisfies z.ZodType<WorldMapSystemWriteModelType>

type WorldMapSectorSelector = { sectorId: number; coordinate?: never } | { sectorId?: never; coordinate: string }
type WorldMapBodySelector = { bodyId: number; coordinate?: never } | { bodyId?: never; coordinate: string }

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

  public async getSystem({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<WorldMapSystemReadModelType, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    const getSystemResult = await this.worldMapsRepository.getStarSystem({ gameId })
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
  }): Promise<Result<WorldMapSectorDetailsReadModelType, string>> {
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
  }): Promise<Result<WorldMapBodyDetailsReadModelType, string>> {
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
