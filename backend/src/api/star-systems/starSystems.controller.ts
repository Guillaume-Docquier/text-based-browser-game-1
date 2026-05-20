import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type {
  StarSystemsRepository,
  StarSystemReadModel,
  OrbitReadModel,
  SectorReadModel,
  BodyReadModel,
  MovementEdge,
} from "#lib/db/star-systems/starSystems.repository.ts"
import { notAuthorized } from "#lib/errors.ts"
import { z } from "zod"
import { BodyType } from "#lib/star-systems/BodyType.ts"

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
  }): Promise<Result<StarSystemReadModel | undefined, string>> {
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

const StarSystemBodyDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: z.enum(BodyType),
  movementNodeId: z.string(),
}) satisfies z.ZodType<BodyReadModel>

const StarSystemSectorDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  bodies: z.array(StarSystemBodyDto),
  movementNodeId: z.string(),
}) satisfies z.ZodType<SectorReadModel>

const StarSystemOrbitDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(StarSystemSectorDto),
}) satisfies z.ZodType<OrbitReadModel>

const MovementEdgeDto = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  weight: z.number(),
}) satisfies z.ZodType<MovementEdge>

export const StarSystemDto = z.object({
  gameId: z.number(),
  orbits: z.array(StarSystemOrbitDto),
  movementEdges: z.record(z.string(), z.array(MovementEdgeDto)),
}) satisfies z.ZodType<StarSystemReadModel>
