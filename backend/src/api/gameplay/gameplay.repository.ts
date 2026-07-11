import { type Branded, Assert, type Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { and, eq, inArray } from "drizzle-orm"
import type { NewStarSystemModel, StarSystemModel } from "#api/gameplay/star-systems/StarSystemModels.ts"
import { StarSystemQueries } from "#api/gameplay/star-systems/StarSystemQueries.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { GameStatus } from "#lib/db/games/GameStatus.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamesTable, gameStatesTable, ordersTable, playersTable, resourcesTable, ticksTable } from "#lib/db/schema.ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"
import { couldNot, TransactionRollback } from "#lib/errors.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type OrderRow = typeof ordersTable.$inferSelect
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTickRow = typeof ticksTable.$inferInsert

export type OrderModel = OrderRow

export type PlayerActionContextModel = {
  tick: number
  money: number
}

export type PlayerViewModel = {
  gameId: number
  playerId: PlayerId
  tick: number
  nextTickAt: Date
  starSystem: StarSystemModel
  resources: {
    money: number
  }
}

/**
 * Owning a GameForStart within a transaction guarantees that the game is locked and can be started at this time.
 */
export type GameForStart = Branded<
  {
    readonly id: GameId
    readonly starSystemGenerationSettings: StarSystemGenerationSettings
    readonly tickInterval: Time
    readonly playerIds: readonly PlayerId[]
  },
  "GameForStart"
>

export type StartGameModel = {
  /**
   * The GameForStart must be acquired in the same transaction
   */
  readonly game: GameForStart
  readonly startedAt: Date
  readonly nextTickAt: Date
  readonly starSystem: NewStarSystemModel
  readonly playerResources: ReadonlyArray<{
    readonly playerId: PlayerId
    readonly resourceType: ResourceType
    readonly amount: number
  }>
}

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger
  private readonly clock: Clock

  public constructor({ logger, db, clock }: { logger: Logger; db: PostgresRepository["db"]; clock: Clock }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
    this.clock = clock
  }

  public async hasPlayerJoinedGame(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const joinedGameResult = await Result.tryCatch(async () => {
      const rows = await db
        .select({ playerId: playersTable.playerId })
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, playerId)))
      Assert.isTrue(rows.length <= 1)

      return rows.length === 1
    })

    if (Result.isFailure(joinedGameResult)) {
      this.logger.error("Could not check if player joined game", { gameId, playerId, error: joinedGameResult.error })
      return Result.Failure(couldNot("check if player joined game"))
    }

    return joinedGameResult
  }

  public async getGameForStart(
    { gameId, requesterAccountId }: { gameId: GameId; requesterAccountId: AccountId },
    tx: Transaction,
  ): Promise<Result<GameForStart, string>> {
    const gamesForStart = await tx
      .select({
        id: gamesTable.id,
        starSystemGenerationSettings: gamesTable.starSystemGenerationSettings,
        tickIntervalSeconds: gamesTable.tickIntervalSeconds,
      })
      .from(gamesTable)
      .where(
        and(
          eq(gamesTable.id, gameId),
          // This is business logic encoded in the repository.
          // It seems efficient: single query, db level checks.
          // But it breaches boundaries: not just data access layer.
          // We'll see how it holds up.
          eq(gamesTable.createdByAccountId, requesterAccountId),
          inArray(gamesTable.status, [GameStatus.WAITING_FOR_PLAYERS, GameStatus.READY_TO_START]),
        ),
      )
      // Locks the game for the rest of the transaction
      .for("no key update")
    Assert.isTrue(gamesForStart.length <= 1)

    const gameForStart = gamesForStart[0]
    if (gameForStart === undefined) {
      return Result.Failure("The game does not exist, cannot be started or this account cannot start it.")
    }

    const playerIdRows = await tx
      .select({ playerId: playersTable.playerId })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameForStart.id))
    Assert.isTrue(playerIdRows.length > 0)

    const playerIds: readonly PlayerId[] = playerIdRows.map(({ playerId }) => playerId)

    // oxlint-disable-next-line typescript/consistent-type-assertions -- Branded
    return Result.Success({
      id: gameForStart.id,
      starSystemGenerationSettings: gameForStart.starSystemGenerationSettings,
      tickInterval: Time.create(gameForStart.tickIntervalSeconds, UnitOfTime.SECONDS),
      playerIds,
    } as GameForStart)
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async startGame(startGameModel: StartGameModel, tx: Transaction): Promise<void> {
    const gameState = {
      gameId: startGameModel.game.id,
      tick: 0,
      nextTickAt: startGameModel.nextTickAt,
    } as const satisfies NewGameStateRow

    const gameTick: NewTickRow = {
      gameId: startGameModel.game.id,
      tick: gameState.tick,
      scheduledFor: startGameModel.nextTickAt,
    }

    const resources: NewResourceRow[] = startGameModel.playerResources.map((playerResource) => ({
      ...playerResource,
      gameId: startGameModel.game.id,
    }))

    const updatedGames = await tx
      .update(gamesTable)
      .set({ startedAt: startGameModel.startedAt, status: GameStatus.COLLECTING_ORDERS })
      .where(and(eq(gamesTable.id, startGameModel.game.id)))
      .returning({ id: gamesTable.id })
    Assert.isTrue(updatedGames.length === 1)

    await tx.insert(resourcesTable).values(resources)
    await tx.insert(gameStatesTable).values(gameState)
    await tx.insert(ticksTable).values(gameTick)
    await StarSystemQueries.insertStarSystem({ gameId: startGameModel.game.id, starSystem: startGameModel.starSystem }, tx)
  }

  public async getPlayerView(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerViewModel | undefined, string>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const gameStates = await tx.select().from(gameStatesTable).where(eq(gameStatesTable.gameId, gameId))
        Assert.isTrue(gameStates.length === 1)

        const gameState = gameStates[0]
        if (gameState === undefined) {
          return undefined
        }

        const starSystem = await StarSystemQueries.selectStarSystem(gameId, tx)

        const playerResources = await tx
          .select()
          .from(resourcesTable)
          .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money, "money")

        return {
          ...gameState,
          playerId,
          starSystem,
          resources: {
            money: money.amount,
          },
        }
      }),
    )

    if (Result.isFailure(playerViewResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerViewResult.error })
      return Result.Failure(couldNot("get player game state by ids"))
    }

    return playerViewResult
  }

  public async getCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  public async getPlayerActionContext(
    params: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerActionContextModel, string>> {
    const contextResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingOrders({ gameId: params.gameId }, tx)

        const joinedPlayers = await tx
          .select({ playerId: playersTable.playerId })
          .from(playersTable)
          .where(and(eq(playersTable.gameId, params.gameId), eq(playersTable.playerId, params.playerId)))
        if (joinedPlayers.length !== 1) {
          throw new TransactionRollback("Player is not in this game.")
        }

        const gameStates = await tx
          .select({ tick: gameStatesTable.tick })
          .from(gameStatesTable)
          .where(eq(gameStatesTable.gameId, params.gameId))
        if (gameStates.length !== 1) {
          throw new TransactionRollback("Game state does not exist.")
        }
        Assert.isDefined(gameStates[0])

        const moneyRows = await tx
          .select({ amount: resourcesTable.amount })
          .from(resourcesTable)
          .where(
            and(
              eq(resourcesTable.gameId, params.gameId),
              eq(resourcesTable.playerId, params.playerId),
              eq(resourcesTable.resourceType, ResourceType.MONEY),
            ),
          )
        if (moneyRows.length !== 1) {
          throw new TransactionRollback("Player money resource does not exist.")
        }
        Assert.isDefined(moneyRows[0])

        return {
          tick: gameStates[0].tick,
          money: moneyRows[0].amount,
        }
      }),
    )

    if (Result.isFailure(contextResult)) {
      this.logger.error("Could not get player action context", { ...params, error: contextResult.error })
      return Result.Failure(couldNot("get player action context"))
    }

    return contextResult
  }

  public async setCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number; actionType: GamePlayerActionType },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel, string>> {
    const upsertResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingOrders({ gameId: params.gameId }, tx)

        const updatedAt = this.clock.now()
        const gamePlayerActions = await tx
          .insert(ordersTable)
          .values({ ...params, updatedAt })
          .onConflictDoUpdate({
            target: [ordersTable.gameId, ordersTable.playerId, ordersTable.tick],
            set: {
              actionType: params.actionType,
              updatedAt,
            },
          })
          .returning()

        Assert.isTrue(gamePlayerActions.length === 1)
        Assert.isDefined(gamePlayerActions[0])

        return gamePlayerActions[0]
      }),
    )

    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not upsert game player action", { ...params, error: upsertResult.error })
      return Result.Failure(couldNot("upsert game player action"))
    }

    return upsertResult
  }

  public async clearCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingOrders({ gameId: params.gameId }, tx)

        await tx
          .delete(ordersTable)
          .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick)))
      }),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player action"))
    }

    return Result.Success(true)
  }
}

async function lockGameCollectingOrders({ gameId }: { gameId: GameId }, db: PostgresRepository["db"]): Promise<void> {
  const games = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(and(eq(gamesTable.id, gameId), eq(gamesTable.status, GameStatus.COLLECTING_ORDERS)))
    .for("no key update")

  if (games.length !== 1) {
    throw new TransactionRollback("Cannot submit orders in the current game status")
  }
}
