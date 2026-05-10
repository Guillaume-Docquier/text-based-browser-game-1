import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games.repository.ts"
import type {
  MapGenerationSettingsReadModel as MapGenerationSettingsReadModelType,
  MapGenerationSettingsWriteModel as MapGenerationSettingsWriteModelType,
  BodyDetailsReadModel,
  BodyReadModel,
  BodyWriteModel,
  MovementEdgeReadModel,
  MovementEdgeWriteModel,
  MovementGraphReadModel,
  OrbitReadModel,
  OrbitWriteModel,
  WorldMapsRepository,
  SectorDetailsReadModel,
  SectorReadModel,
  SectorWriteModel,
  StarSystemReadModel,
  StarSystemWriteModel,
} from "#lib/db/worldMaps.repository.ts"
import z from "zod"
import type { IntegerRange, IntegerRange as MapGenerationRangeWriteModelType } from "#lib/Range.ts"
import { notAuthorized } from "#lib/errors.ts"
import { BodyType } from "#lib/world-maps/BodyType.ts"

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
}) satisfies z.ZodType<MovementEdgeReadModel>

export const WorldMapMovementGraphReadModel = z.object({
  edges: z.record(z.string(), z.array(WorldMapMovementEdgeReadModel)),
}) satisfies z.ZodType<MovementGraphReadModel>

export const WorldMapBodyReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: BodyTypeReadModel,
  movementNodeId: z.number(),
}) satisfies z.ZodType<BodyReadModel>

export const WorldMapSectorReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  bodies: z.array(WorldMapBodyReadModel),
  movementNodeId: z.number(),
}) satisfies z.ZodType<SectorReadModel>

export const WorldMapSectorDetailsReadModel = WorldMapSectorReadModel.extend({
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<SectorDetailsReadModel>

export const WorldMapBodyDetailsReadModel = WorldMapBodyReadModel.extend({
  orbitId: z.number(),
  orbitNumber: z.number(),
  orbitCoordinates: z.string(),
  sectorId: z.number(),
  sectorNumber: z.number(),
  sectorCoordinates: z.string(),
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<BodyDetailsReadModel>

export const WorldMapOrbitReadModel = z.object({
  id: z.number(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(WorldMapSectorReadModel),
}) satisfies z.ZodType<OrbitReadModel>

export const WorldMapSystemReadModel = z.object({
  gameId: z.number(),
  generationSettings: MapGenerationSettingsReadModel,
  orbits: z.array(WorldMapOrbitReadModel),
  movementGraph: WorldMapMovementGraphReadModel,
}) satisfies z.ZodType<StarSystemReadModel>

export const WorldMapMovementEdgeWriteModel = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().optional(),
}) satisfies z.ZodType<MovementEdgeWriteModel>

export const WorldMapBodyWriteModel = z.object({
  number: z.number(),
  type: BodyTypeReadModel,
  name: z.string(),
  movementNodeKey: z.string(),
}) satisfies z.ZodType<BodyWriteModel>

export const WorldMapSectorWriteModel = z.object({
  number: z.number(),
  movementNodeKey: z.string(),
  bodies: z.array(WorldMapBodyWriteModel),
}) satisfies z.ZodType<SectorWriteModel>

export const WorldMapOrbitWriteModel = z.object({
  number: z.number(),
  sectors: z.array(WorldMapSectorWriteModel),
}) satisfies z.ZodType<OrbitWriteModel>

export const WorldMapSystemWriteModel = z.object({
  gameId: z.number(),
  generationSettings: MapGenerationSettingsWriteModel,
  orbits: z.array(WorldMapOrbitWriteModel),
  movementEdges: z.array(WorldMapMovementEdgeWriteModel),
}) satisfies z.ZodType<StarSystemWriteModel>

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

  public async getSystem({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<StarSystemReadModel, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ playerId, gameId })
    }

    return await this.worldMapsRepository.getStarSystem({ gameId })
  }

  public async getSector({
    gameId,
    playerId,
    sectorId,
  }: {
    gameId: number
    playerId: number
    sectorId: number
  }): Promise<Result<SectorDetailsReadModel, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ playerId, gameId })
    }

    return await this.worldMapsRepository.getSector({ gameId, sectorId })
  }

  public async getBody({
    gameId,
    playerId,
    selector,
  }: {
    gameId: number
    playerId: number
    selector: WorldMapBodySelector
  }): Promise<Result<BodyDetailsReadModel, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ playerId, gameId })
    }

    return await this.worldMapsRepository.getBody({ gameId, selector })
  }

  private async canReadGame({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<boolean, string>> {
    return await this.gamesRepository.hasPlayerJoinedGame({ gameId, playerId })
  }

  private notAuthorizedFailure({ playerId, gameId }: { playerId: number; gameId: number }): Failure<string> {
    const error = notAuthorized({ playerId, operationName: `read game with id ${gameId}` })
    this.logger.error(error)
    return Result.Failure(error)
  }
}
