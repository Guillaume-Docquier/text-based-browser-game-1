import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { notAuthorized } from "#lib/errors.ts"
import { z } from "zod"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { RangeDto } from "#api/RangeDto.ts"

const StarSystemBodyDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: z.enum(BodyType),
  movementNodeId: z.string(),
})

const StarSystemSectorDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  angleRange: RangeDto,
  bodies: z.array(StarSystemBodyDto),
  movementNodeId: z.string(),
})

const StarSystemOrbitDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(StarSystemSectorDto),
})

const MovementEdgeDto = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  weight: z.number(),
})

export type StarSystemDto = z.infer<typeof StarSystemDto>
export const StarSystemDto = z.object({
  gameId: z.number(),
  orbits: z.array(StarSystemOrbitDto),
  movementEdges: z.record(z.string(), z.array(MovementEdgeDto)),
})

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

  public async getByGameId({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<StarSystemDto | undefined, string>> {
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
