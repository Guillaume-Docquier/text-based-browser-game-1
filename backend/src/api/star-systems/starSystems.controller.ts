import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type {
  StarSystemGenerationSettings as StarSystemGenerationSettingsWriteModelType,
  BodyReadModel,
  Body,
  MovementEdgeReadModel,
  MovementEdge,
  MovementNode,
  OrbitReadModel,
  Orbit,
  StarSystemsRepository,
  SectorReadModel,
  Sector,
  StarSystemReadModel as StarSystemReadModelType,
  NewStarSystem as StarSystemWriteModelType,
  StarSystemReadModel,
} from "#lib/db/star-systems/starSystems.repository.ts"
import z from "zod"
import type { IntegerRange, IntegerRange as StarSystemGenerationRangeWriteModelType } from "#lib/Range.ts"
import { notAuthorized } from "#lib/errors.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"

export const StarSystemGenerationRangeWriteModel = z.object({ min: z.number(), max: z.number() }).refine(({ min, max }) => min <= max, {
  message: "Range min must be lower than or equal to max.",
}) satisfies z.ZodType<StarSystemGenerationRangeWriteModelType>

export const StarSystemGenerationIntegerRangeWriteModel = z
  .object({ min: z.number().int(), max: z.number().int() })
  .refine(({ min, max }) => min <= max, {
    message: "Range min must be lower than or equal to max.",
  }) satisfies z.ZodType<IntegerRange>

export const StarSystemGenerationSettingsWriteModel = z.object({
  planetDensity: StarSystemGenerationRangeWriteModel.refine(({ min, max }) => min >= 0 && max <= 1, {
    message: "Planet density must be between 0 and 1.",
  }),
  nbPlanets: StarSystemGenerationIntegerRangeWriteModel,
  nbMoonsPerPlanet: StarSystemGenerationIntegerRangeWriteModel,
  nbAsteroidBelts: StarSystemGenerationIntegerRangeWriteModel,
  nbAsteroidsPerSector: StarSystemGenerationIntegerRangeWriteModel,
  seed: z.number(),
}) satisfies z.ZodType<StarSystemGenerationSettingsWriteModelType>

export const StarSystemGenerationSettingsReadModel = StarSystemGenerationSettingsWriteModel

const BodyTypeReadModel = z.enum(BodyType)
const Uuid = z.string().uuid()

export const StarSystemMovementEdgeReadModel = z.object({
  fromNodeId: Uuid,
  toNodeId: Uuid,
  weight: z.number(),
}) satisfies z.ZodType<MovementEdgeReadModel>

export const StarSystemMovementGraphReadModel = z.record(z.string(), z.array(StarSystemMovementEdgeReadModel)) satisfies z.ZodType<
  StarSystemReadModel["movementEdges"]
>

export const StarSystemBodyReadModel = z.object({
  id: Uuid,
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: BodyTypeReadModel,
  movementNodeId: Uuid,
}) satisfies z.ZodType<BodyReadModel>

export const StarSystemSectorReadModel = z.object({
  id: Uuid,
  number: z.number(),
  coordinates: z.string(),
  bodies: z.array(StarSystemBodyReadModel),
  movementNodeId: Uuid,
}) satisfies z.ZodType<SectorReadModel>

export const StarSystemOrbitReadModel = z.object({
  id: Uuid,
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(StarSystemSectorReadModel),
}) satisfies z.ZodType<OrbitReadModel>

export const StarSystemReadModelSchema = z.object({
  gameId: z.number(),
  orbits: z.array(StarSystemOrbitReadModel),
  movementEdges: StarSystemMovementGraphReadModel,
}) satisfies z.ZodType<StarSystemReadModel>

export const StarSystemMovementEdgeWriteModel = z.object({
  fromNodeId: Uuid,
  toNodeId: Uuid,
  weight: z.number(),
}) satisfies z.ZodType<MovementEdge>

export const StarSystemMovementNodeWriteModel = z.object({
  id: Uuid,
}) satisfies z.ZodType<MovementNode>

export const StarSystemBodyWriteModel = z.object({
  id: Uuid,
  sectorId: Uuid,
  bodyNumber: z.number(),
  bodyType: BodyTypeReadModel,
  name: z.string(),
  movementNodeId: Uuid,
}) satisfies z.ZodType<Body>

export const StarSystemSectorWriteModel = z.object({
  id: Uuid,
  orbitId: Uuid,
  sectorNumber: z.number(),
  movementNodeId: Uuid,
}) satisfies z.ZodType<Sector>

export const StarSystemOrbitWriteModel = z.object({
  id: Uuid,
  orbitNumber: z.number(),
}) satisfies z.ZodType<Orbit>

export const StarSystemWriteModel = z.object({
  gameId: z.number(),
  generationSettings: StarSystemGenerationSettingsWriteModel,
  movementNodes: z.array(StarSystemMovementNodeWriteModel),
  orbits: z.array(StarSystemOrbitWriteModel),
  sectors: z.array(StarSystemSectorWriteModel),
  bodies: z.array(StarSystemBodyWriteModel),
  movementEdges: z.array(StarSystemMovementEdgeWriteModel),
}) satisfies z.ZodType<StarSystemWriteModelType>

export class StarSystemsController {
  private readonly gamesRepository: GamesRepository
  private readonly starSystemsRepository: StarSystemsRepository
  private readonly logger: Logger

  public constructor({
    gamesRepository,
    starSystemsRepository,
    logger,
  }: {
    gamesRepository: GamesRepository
    starSystemsRepository: StarSystemsRepository
    logger: Logger
  }) {
    this.gamesRepository = gamesRepository
    this.starSystemsRepository = starSystemsRepository
    this.logger = logger.child({ scope: "star-systems-controller" })
  }

  public async getByGameId({
    gameId,
    playerId,
  }: {
    gameId: number
    playerId: number
  }): Promise<Result<StarSystemReadModelType | undefined, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ playerId, gameId })
    }

    return await this.starSystemsRepository.getByGameId({ gameId })
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
