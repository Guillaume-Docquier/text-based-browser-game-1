import { Datetime, type Logger, mulberry32Prng, Result, Rng, Timer } from "@guillaume-docquier/tools-ts"
import { computeAvailableActions } from "shared/action-submission/computeAvailableActions.ts"
import { GameIdSchema } from "shared/domain/game/GameId.ts"
import { GameStatus } from "shared/domain/game/GameStatus.ts"
import { AccountIdSchema } from "shared/domain/identity/AccountId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { createGalaxy } from "shared/galaxy-creation/createGalaxy.ts"
import { GalaxyCreationSettings } from "shared/galaxy-creation/GalaxyCreationSettings.ts"
import { z } from "zod"
import type { Clock } from "#lib/Clock.ts"
import type { CreateTransaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { couldNot } from "#lib/errors.ts"
import { UInt32 } from "#lib/UInt32.ts"
import type { GameplayRepository } from "./gameplay.repository.ts"

/**
 * Starts a game and initializes its galaxy, resources, and first Turn atomically.
 */
export class StartGameUseCase {
  private readonly logger: Logger
  private readonly clock: Clock
  private readonly gameplayRepository: GameplayRepository
  private readonly createTransaction: CreateTransaction

  public constructor({
    logger,
    clock,
    gameplayRepository,
    createTransaction,
  }: {
    logger: Logger
    clock: Clock
    gameplayRepository: GameplayRepository
    createTransaction: CreateTransaction
  }) {
    this.logger = logger.child({ scope: "start-game-use-case" })
    this.clock = clock
    this.gameplayRepository = gameplayRepository
    this.createTransaction = createTransaction
  }

  public async execute({ gameId, requesterAccountId }: StartGameDto): Promise<Result<StartedGameDto, string>> {
    const startGameResult = await this.createTransaction(async (tx) => {
      const gameForStart = await this.gameplayRepository.getGameForStart({ gameId }, tx)

      if (gameForStart.createdByAccountId !== requesterAccountId) {
        throw new TransactionRollbackError("Only the game creator can start it.")
      }

      if (gameForStart.status !== GameStatus.WAITING_FOR_PLAYERS && gameForStart.status !== GameStatus.READY_TO_START) {
        throw new TransactionRollbackError("The game cannot start in its current status.", {
          cause: { status: gameForStart.status, expected: [GameStatus.WAITING_FOR_PLAYERS, GameStatus.READY_TO_START] },
        })
      }

      const startedAt = this.clock.now()
      const turnEndsAt = Datetime.increment({ date: startedAt, time: gameForStart.turnInterval })

      const startingResources = Object.values(ResourceType).map((resourceType) => ({
        resourceType,
        amount: gameForStart.ruleset.startingResources[resourceType],
      }))
      const playerResources = gameForStart.playerIds.flatMap((playerId) => startingResources.map((resource) => ({ playerId, ...resource })))

      const startTime = Timer.start()
      const rng = Rng.create(mulberry32Prng(gameForStart.mapGenerationSeed))
      const galaxy = createGalaxy({ galaxyCreationSettings: GalaxyCreationSettings, playerIds: gameForStart.playerIds, rng })
      this.logger.debug("Generated galaxy", { elapsedTime: Timer.since(startTime) })

      await this.gameplayRepository.startGame(
        {
          context: gameForStart,
          status: GameStatus.IN_PROGRESS,
          startedAt,
          turnEndsAt,
          // Do not reuse the map generation seed, use a "secret" one, otherwise the game can be controlled by the creator
          rngState: { generatorState: UInt32.random(), spareNormal: null },
          playerResources,
          availableActions: computeAvailableActions({
            playerIds: gameForStart.playerIds,
            ruleset: gameForStart.ruleset,
          }),
          galaxy,
        },
        tx,
      )

      return { turnEndsAt }
    })

    if (Result.isFailure(startGameResult)) {
      this.logger.error("Could not start game", { gameId, requesterAccountId, error: startGameResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startGameResult
  }
}

export type StartGameDto = z.infer<typeof StartGameDtoSchema>
export const StartGameDtoSchema = z.object({
  gameId: z.coerce.number().pipe(GameIdSchema),
  requesterAccountId: AccountIdSchema,
})

export type StartedGameDto = z.infer<typeof StartedGameDtoSchema>
export const StartedGameDtoSchema = z.object({
  turnEndsAt: z.date(),
})
