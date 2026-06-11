import { type Failure, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/games/GameId.ts"
import { type LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { RangeDto } from "#api/shared/RangeDto.ts"
import type { StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { notAuthorized } from "#lib/errors.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"

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
  private readonly lobbiesRepository: LobbiesRepository
  private readonly starSystemsRepository: StarSystemsRepository

  public constructor({
    logger,
    lobbiesRepository,
    starSystemsRepository,
  }: {
    logger: Logger
    lobbiesRepository: LobbiesRepository
    starSystemsRepository: StarSystemsRepository
  }) {
    this.logger = logger.child({ scope: "star-systems-controller" })
    this.lobbiesRepository = lobbiesRepository
    this.starSystemsRepository = starSystemsRepository
  }

  public async getByGameId({
    gameId,
    accountId,
  }: {
    gameId: GameId
    accountId: AccountId
  }): Promise<Result<StarSystemDto | undefined, string>> {
    const canReadGameResult = await this.canReadGame({ gameId, accountId })
    if (Result.isFailure(canReadGameResult)) {
      return canReadGameResult
    }

    if (!canReadGameResult.value) {
      return this.notAuthorizedFailure({ accountId, gameId })
    }

    return await this.starSystemsRepository.getByGameId({ gameId })
  }

  private async canReadGame({ gameId, accountId }: { gameId: GameId; accountId: AccountId }): Promise<Result<boolean, string>> {
    return await this.lobbiesRepository.hasAccountJoinedLobby({ gameId, accountId })
  }

  private notAuthorizedFailure({ accountId, gameId }: { accountId: AccountId; gameId: GameId }): Failure<string> {
    const error = notAuthorized({ accountId, operationName: `read game with id ${gameId}` })
    this.logger.error(error)
    return Result.Failure(error)
  }
}
