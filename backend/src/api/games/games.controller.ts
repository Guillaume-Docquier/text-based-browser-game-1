import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { type GameId } from "#api/games/GameId.ts"
import { type PlayerId } from "#api/games/PlayerId.ts"
import { type LobbyDto, toGameLobbyDto } from "#api/lobbies/gameLobbies.controller.ts"
import { type GameLobbiesRepository } from "#api/lobbies/gameLobbies.repository.ts"
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
  private readonly gameLobbiesRepository: GameLobbiesRepository
  private readonly gameStatesRepository: GameStatesRepository
  private readonly gameTicksRepository: GameTicksRepository
  private readonly gamePlayerResourcesRepository: GamePlayerResourcesRepository

  public constructor({
    logger,
    createTransaction,
    gamesRepository,
    gameLobbiesRepository,
    gameStatesRepository,
    gameTicksRepository,
    gamePlayerResourcesRepository,
  }: {
    logger: Logger
    createTransaction: CreateTransaction
    gamesRepository: GamesRepository
    gameLobbiesRepository: GameLobbiesRepository
    gameStatesRepository: GameStatesRepository
    gameTicksRepository: GameTicksRepository
    gamePlayerResourcesRepository: GamePlayerResourcesRepository
  }) {
    this.logger = logger.child({ scope: "games-controller" })
    this.createTransaction = createTransaction
    this.gamesRepository = gamesRepository
    this.gameLobbiesRepository = gameLobbiesRepository
    this.gameStatesRepository = gameStatesRepository
    this.gameTicksRepository = gameTicksRepository
    this.gamePlayerResourcesRepository = gamePlayerResourcesRepository
  }

  /**
   * Gets ALL the game lobbies. This only makes sense until we have real traffic.
   */
  public async getGameLobbies({ playerId }: { playerId: PlayerId | undefined }): Promise<LobbyDto[]> {
    const gameLobbiesResult = await this.gameLobbiesRepository.getLobbies()
    if (Result.isFailure(gameLobbiesResult)) {
      this.logger.error("Could not get game lobbies, returning empty array", { playerId, error: gameLobbiesResult.error })
      return []
    }

    return gameLobbiesResult.value.map((gameLobbyModel) => toGameLobbyDto({ gameLobbyModel, playerId }))
  }

  public async startGame({ gameId, playerId }: { gameId: GameId; playerId: PlayerId }): Promise<Result<LobbyDto, string>> {
    const gameStartResult = await Result.tryCatch(
      this.createTransaction(async (tx): Promise<void> => {
        const gameLobbyResult = await this.gameLobbiesRepository.getLobbyById({ gameId }, tx)
        rollbackOnFailure(gameLobbyResult, "Failed to get game lobby")

        const gameLobbyModel = gameLobbyResult.value
        if (gameLobbyModel === undefined) {
          throw new TransactionRollback("Cannot start game, the lobby could not be found")
        }

        if (!toGameLobbyDto({ gameLobbyModel, playerId }).canStart) {
          throw new TransactionRollback("Cannot start game, this player is not allowed to start it at the moment")
        }

        const startedAt = new Date()
        const startGameResult = await this.gamesRepository.updateGame({ gameId }, { startedAt }, tx)
        rollbackOnFailure(startGameResult, "Failed to update game start date")

        const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: gameLobbyModel.configuration.tickIntervalSeconds })
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

    const gameLobbyResult = await this.gameLobbiesRepository.getLobbyById({ gameId })
    Assert.isSuccess(gameLobbyResult)
    Assert.isDefined(gameLobbyResult.value)

    return Result.Success(toGameLobbyDto({ gameLobbyModel: gameLobbyResult.value, playerId }))
  }
}
