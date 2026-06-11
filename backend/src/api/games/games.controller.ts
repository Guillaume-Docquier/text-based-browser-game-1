import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import type { GameListingsRepository } from "#api/game-listings/gameListings.repository.ts"
import { GameId } from "#api/games/GameId.ts"
import { type PlayerId } from "#api/games/PlayerId.ts"
import { type LobbyDto, toLobbyDto } from "#api/lobbies/lobbies.controller.ts"
import { type LobbiesRepository } from "#api/lobbies/lobbies.repository.ts"
import { GameStatus } from "#api/shared/GameStatus.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamesRepository } from "#lib/db/games/games.repository.ts"
import type { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import type { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import type { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import { couldNot, rollbackOnFailure, TransactionRollback } from "#lib/errors.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/gameResources.ts"
import { computeNextTickDate } from "#tick-processing/processTick.ts"

export class GamesController {
  private readonly logger: Logger
  private readonly createTransaction: CreateTransaction
  private readonly gamesRepository: GamesRepository
  private readonly lobbiesRepository: LobbiesRepository
  private readonly gameListingsRepository: GameListingsRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gameTicksRepository: GameTicksRepository
  private readonly gamePlayerResourcesRepository: GamePlayerResourcesRepository

  public constructor({
    logger,
    createTransaction,
    gamesRepository,
    lobbiesRepository,
    gameListingsRepository,
    gameStatesRepository,
    gameTicksRepository,
    gamePlayerResourcesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gamesRepository: GamesRepository
    lobbiesRepository: LobbiesRepository
    gameListingsRepository: GameListingsRepository
    gameStatesRepository: GameStatesRepository
    gameTicksRepository: GameTicksRepository
    gamePlayerResourcesRepository: GamePlayerResourcesRepository
  }) {
    this.logger = logger.child({ scope: "games-controller" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
    this.lobbiesRepository = lobbiesRepository
    this.gameListingsRepository = gameListingsRepository
    this.gameStatesRepository = gameStatesRepository
    this.gameTicksRepository = gameTicksRepository
    this.gamePlayerResourcesRepository = gamePlayerResourcesRepository
  }

  /**
   * Gets ALL the game listings. This only makes sense until we have real traffic.
   */
  public async getListings(): Promise<ListingDto[]> {
    const getListingsResults = await this.gameListingsRepository.getListings()
    if (Result.isFailure(getListingsResults)) {
      this.logger.error("Could not get game listings, returning empty array", { error: getListingsResults.error })
      return []
    }

    return getListingsResults.value
  }

  public async startGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<LobbyDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const lobbyResult = await this.lobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(lobbyResult, "Failed to get game lobby")

        const lobbyModel = lobbyResult.value
        if (lobbyModel === undefined) {
          throw new TransactionRollback("Cannot start game, the lobby could not be found")
        }

        if (!toLobbyDto({ lobbyModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = new Date()
        const startGameResult = await this.gamesRepository.updateGame({ gameId }, { startedAt }, tx)
        rollbackOnFailure(startGameResult, "Failed to update game start date")

        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: lobbyModel.configuration.tickIntervalSeconds })
        const gameStateResult = await this.gameStatesRepository.create({ gameId, nextTickAt }, tx)
        rollbackOnFailure(gameStateResult, "Failed to create initial game state")

        const playerIdsResult = await this.gamesRepository.getPlayerIds({ gameId }, tx)
        rollbackOnFailure(playerIdsResult, "Failed to get player ids to setup initial resources")

        const createStartingResourcesResult = await this.gamePlayerResourcesRepository.createMany(
          playerIdsResult.value.flatMap((resourcePlayerId) =>
            Object.values(ResourceType).map((resourceType) => ({
              gameId,
              playerId: resourcePlayerId,
              resourceType,
              amount: STARTING_RESOURCE_AMOUNTS[resourceType],
            })),
          ),
          tx,
        )
        rollbackOnFailure(createStartingResourcesResult, "Failed to create initial resources")

        const gameTickResult = await this.gameTicksRepository.create(
          { gameId, tick: gameStateResult.value.tick, scheduledFor: gameStateResult.value.nextTickAt },
          tx,
        )
        rollbackOnFailure(gameTickResult, "Failed to schedule first game tick")
      }),
    )

    if (Result.isFailure(gameStartResult)) {
      this.logger.error("Could not start game", { gameId, playerId, error: gameStartResult.error })
      return Result.Failure(couldNot("start game"))
    }

    const lobbyResult = await this.lobbiesRepository.getLobbyById({ gameId })
    Assert.isSuccess(lobbyResult)
    Assert.isDefined(lobbyResult.value)

    return Result.Success(toLobbyDto({ lobbyModel: lobbyResult.value, playerId }))
  }
}

export type ListingDto = z.infer<typeof ListingDto>
export const ListingDto = z.object({
  id: GameId,
  name: z.string(),
  nbPlayers: z.number(),
  nbSeats: z.number(),
  status: z.enum(GameStatus),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
})
