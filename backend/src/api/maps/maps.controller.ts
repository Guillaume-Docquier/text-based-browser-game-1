import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GamePlayersRepository } from "#lib/db/games/gamePlayers.repository.ts"
import type { MapsRepository } from "#lib/db/maps/maps.repository.ts"
import { notAuthorized } from "#lib/errors.ts"
import { z } from "zod"
import { BodyType } from "#lib/maps/BodyType.ts"
import { RangeDto } from "#api/RangeDto.ts"

const MapBodyDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  name: z.string(),
  type: z.enum(BodyType),
  movementNodeId: z.string(),
})

const MapSectorDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  angleRange: RangeDto,
  bodies: z.array(MapBodyDto),
  movementNodeId: z.string(),
})

const MapOrbitDto = z.object({
  id: z.string(),
  number: z.number(),
  coordinates: z.string(),
  sectors: z.array(MapSectorDto),
})

const MovementEdgeDto = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  weight: z.number(),
})

export type MapDto = z.infer<typeof MapDto>
export const MapDto = z.object({
  gameId: z.number(),
  orbits: z.array(MapOrbitDto),
  movementEdges: z.record(z.string(), z.array(MovementEdgeDto)),
})

export class MapsController {
  private readonly logger: Logger
  private readonly gamePlayersRepository: GamePlayersRepository
  private readonly mapsRepository: MapsRepository

  public constructor({
    logger,
    gamePlayersRepository,
    mapsRepository,
  }: {
    logger: Logger
    gamePlayersRepository: GamePlayersRepository
    mapsRepository: MapsRepository
  }) {
    this.logger = logger.child({ scope: "maps-controller" })
    this.gamePlayersRepository = gamePlayersRepository
    this.mapsRepository = mapsRepository
  }

  public async getByGameId({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<MapDto | undefined, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, playerId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ playerId, gameId })
    }

    return await this.mapsRepository.getByGameId({ gameId })
  }

  private async canReadGame({ gameId, playerId }: { gameId: number; playerId: number }): Promise<Result<boolean, string>> {
    return await this.gamePlayersRepository.hasPlayerJoinedGame({ gameId, playerId })
  }

  private notAuthorizedFailure({ playerId, gameId }: { playerId: number; gameId: number }): Failure<string> {
    const error = notAuthorized({ playerId, operationName: `read game with id ${gameId}` })
    this.logger.error(error)
    return Result.Failure(error)
  }
}
