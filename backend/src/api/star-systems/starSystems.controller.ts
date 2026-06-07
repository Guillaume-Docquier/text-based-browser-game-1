import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { PlayersRepository } from "#lib/db/games/players.repository.ts"
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
  private readonly logger: Logger
  private readonly playersRepository: PlayersRepository
  private readonly starSystemsRepository: StarSystemsRepository

  public constructor({
    logger,
    playersRepository,
    starSystemsRepository,
  }: {
    logger: Logger
    playersRepository: PlayersRepository
    starSystemsRepository: StarSystemsRepository
  }) {
    this.logger = logger.child({ scope: "star-systems-controller" })
    this.playersRepository = playersRepository
    this.starSystemsRepository = starSystemsRepository
  }

  public async getByGameId({
    gameId,
    accountId,
  }: {
    gameId: number
    accountId: string
  }): Promise<Result<StarSystemDto | undefined, string>> {
    const playerResult = await this.playersRepository.getByGameIdAndAccountId({ gameId, accountId })
    if (Result.isFailure(playerResult)) {
      return playerResult
    }

    if (playerResult.value === undefined) {
      return this.notAuthorizedFailure({ accountId, gameId })
    }

    return await this.starSystemsRepository.getByGameId({ gameId })
  }

  private notAuthorizedFailure({ accountId, gameId }: { accountId: string; gameId: number }): Failure<string> {
    const error = notAuthorized({ accountId, operationName: `read game with id ${gameId}` })
    this.logger.error(error)
    return Result.Failure(error)
  }
}
