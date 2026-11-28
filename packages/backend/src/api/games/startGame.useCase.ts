import { Assert, branded, Datetime, type Logger, mulberry32Prng, Result, Rng, Timer, UInt32 } from "@guillaume-docquier/tools-ts"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import { GameStatus } from "shared/domain/games/GameStatus.ts"
import { STARTING_CREDITS } from "shared/domain/games/startingCredits.ts"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { ShipType, type ShipId } from "shared/domain/world/ships/Ship.ts"
import { createGalaxy } from "shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "shared/galaxy-creation/GalaxyCreationSettings.ts"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import type { GamesRepository } from "./games.repository.ts"
import type { StartGameCommand } from "./startGame.command.ts"
import { StartGameError, StartGameRollbackError } from "./startGame.error.ts"

export class StartGameUseCase {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gamesRepository: GamesRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gamesRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gamesRepository: GamesRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "start-game-use-case" })
    this.clock = clock
    this.gamesRepository = gamesRepository
    this.createTransaction = createTransaction
  }

  public async execute(
    { gameId }: StartGameCommand,
    { requesterAccountId }: { requesterAccountId: AccountId },
  ): Promise<Result<void, StartGameError>> {
    const startGameResult = await this.createTransaction(async (tx) => {
      const gameForStart = await this.gamesRepository.getGameForStart({ gameId }, tx)

      if (gameForStart.createdByAccountId !== requesterAccountId) {
        throw new StartGameRollbackError(StartGameError.NOT_GAME_CREATOR)
      }

      if (gameForStart.status !== GameStatus.WAITING_FOR_PLAYERS && gameForStart.status !== GameStatus.READY_TO_START) {
        throw new StartGameRollbackError(StartGameError.INVALID_GAME_STATUS)
      }

      const startedAt = this.clock.now()
      const turnEndsAt = Datetime.increment({ date: startedAt, time: gameForStart.turnInterval })

      const startTime = Timer.start()
      const rng = Rng.create(mulberry32Prng(gameForStart.mapGenerationSeed))
      const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: gameForStart.playerIds, rng })
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      const homes = new Map(
        galaxy.systems.flatMap(({ planets }) =>
          planets.filter((planet) => planet.ownerPlayerId !== null).map((planet) => [planet.ownerPlayerId, planet.id] as const),
        ),
      )
      const ships = gameForStart.playerIds.toSorted().map((ownerPlayerId, index) => {
        const planetId = homes.get(ownerPlayerId)
        Assert.isDefined(planetId)
        return { id: branded<ShipId>(`T-${String(index + 1).padStart(2, "0")}`), ownerPlayerId, planetId, type: ShipType.TRANSPORT }
      })
      await this.gamesRepository.startGame(
        {
          context: gameForStart,
          status: GameStatus.IN_PROGRESS,
          startingCredits: STARTING_CREDITS,
          startedAt,
          turnEndsAt,
          rngState: { generatorState: UInt32.random(), spareNormal: null },
          galaxy,
          ships,
          buildings: [...homes.values()].flatMap((planetId) => [
            { type: BuildingType.COMMAND_CENTER, planetId, site: 0 },
            { type: BuildingType.TRADE_CENTER, planetId, site: 1 },
          ]),
        },
        tx,
      )
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Could not start game", { gameId, requesterAccountId, error: startGameResult.error })
      if (startGameResult.error instanceof StartGameRollbackError) {
        return Result.Failure(startGameResult.error.code)
      }

      return Result.Failure(StartGameError.UNKNOWN)
    }

    return startGameResult
  }
}
