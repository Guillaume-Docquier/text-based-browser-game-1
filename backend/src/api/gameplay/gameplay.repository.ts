import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  gamePlayerActionsTable,
  gamePlayerResourcesTable,
  gamesTable,
  gameStatesTable,
  gameTicksTable,
  playersTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type GameStateRow = typeof gameStatesTable.$inferSelect
type GamePlayerActionRow = typeof gamePlayerActionsTable.$inferSelect
type NewResourceRow = typeof gamePlayerResourcesTable.$inferInsert
type NewTickRow = typeof gameTicksTable.$inferInsert

export type GameStateModel = GameStateRow
export type GamePlayerActionModel = GamePlayerActionRow

export type PlayerViewModel = {
  gameId: number
  playerId: PlayerId
  tick: number
  nextTickAt: Date
  resources: {
    money: number
  }
}

export type StartGameModel = {
  gameId: GameId
  startedAt: Date
  nextTickAt: Date
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
    }
  >
}

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
  }

  public async startGame(
    startGameModel: StartGameModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ nextTickAt: Date }, string>> {
    const gameState = {
      gameId: startGameModel.gameId,
      tick: 0,
      nextTickAt: startGameModel.nextTickAt,
    } as const satisfies NewGameStateRow

    const playerResources: NewResourceRow[] = Object.entries(startGameModel.players).flatMap(([playerId, { resources }]) =>
      resources.map((resource) => ({
        gameId: startGameModel.gameId,
        playerId,
        ...resource,
      })),
    )
    Assert.isTrue(playerResources.length > 0)

    const gameTick: NewTickRow = {
      gameId: startGameModel.gameId,
      tick: gameState.tick,
      scheduledFor: startGameModel.nextTickAt,
    }

    const startResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await tx.update(gamesTable).set({ startedAt: startGameModel.startedAt }).where(eq(gamesTable.id, startGameModel.gameId))
        await tx.insert(gameStatesTable).values(gameState)
        await tx.insert(gamePlayerResourcesTable).values(playerResources)
        await tx.insert(gameTicksTable).values(gameTick)
      }),
    )

    if (Result.isFailure(startResult)) {
      this.logger.error("Could not start game", { startGameModel, error: startResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return Result.Success({ nextTickAt: gameState.nextTickAt })
  }

  public async getPlayerIds({ gameId }: { gameId: GameId }, db: PostgresRepository["db"] = this.db): Promise<Result<PlayerId[], string>> {
    const gamePlayersResult = await Result.tryCatch(
      db.select({ playerId: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId)),
    )

    if (Result.isFailure(gamePlayersResult)) {
      this.logger.error("Could not get player ids", { gameId, error: gamePlayersResult.error })
      return Result.Failure(couldNot("get player ids"))
    }

    return Result.Success(gamePlayersResult.value.map(({ playerId }) => playerId))
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

        const playerResources = await tx
          .select()
          .from(gamePlayerResourcesTable)
          .where(and(eq(gamePlayerResourcesTable.gameId, gameId), eq(gamePlayerResourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money)

        return {
          ...gameState,
          playerId,
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
  ): Promise<Result<GamePlayerActionModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(gamePlayerActionsTable)
        .where(
          and(
            eq(gamePlayerActionsTable.gameId, params.gameId),
            eq(gamePlayerActionsTable.playerId, params.playerId),
            eq(gamePlayerActionsTable.tick, params.tick),
          ),
        ),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  public async setCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number; actionType: GamePlayerActionType },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionModel, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = new Date()
      const gamePlayerActions = await db
        .insert(gamePlayerActionsTable)
        .values({ ...params, updatedAt })
        .onConflictDoUpdate({
          target: [gamePlayerActionsTable.gameId, gamePlayerActionsTable.playerId, gamePlayerActionsTable.tick],
          set: {
            actionType: params.actionType,
            updatedAt,
          },
        })
        .returning()

      Assert.isTrue(gamePlayerActions.length === 1)
      Assert.isDefined(gamePlayerActions[0])

      return gamePlayerActions[0]
    })

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
      db
        .delete(gamePlayerActionsTable)
        .where(
          and(
            eq(gamePlayerActionsTable.gameId, params.gameId),
            eq(gamePlayerActionsTable.playerId, params.playerId),
            eq(gamePlayerActionsTable.tick, params.tick),
          ),
        ),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player action"))
    }

    return Result.Success(true)
  }

  public async getActionsForTick(
    params: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GamePlayerActionModel[], string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(gamePlayerActionsTable)
        .where(and(eq(gamePlayerActionsTable.gameId, params.gameId), eq(gamePlayerActionsTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player actions by tick", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player actions by tick"))
    }

    return Result.Success(getResult.value)
  }

  public async endGameWithWinner(
    { gameId, winnerAccountId }: { gameId: GameId; winnerAccountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const endResult = await Result.tryCatch(
      db.update(gamesTable).set({ endedAt: new Date(), winnerAccountId }).where(eq(gamesTable.id, gameId)),
    )

    if (Result.isFailure(endResult)) {
      this.logger.error("Could not end game with winner", { gameId, winnerAccountId, error: endResult.error })
      return Result.Failure(couldNot("end game with winner"))
    }

    return Result.Success(true)
  }

  public async updateGameState(
    { gameId }: { gameId: GameId },
    gameState: Partial<NewGameStateRow>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(db.update(gameStatesTable).set(gameState).where(eq(gameStatesTable.gameId, gameId)))

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game state", { gameId, gameState, error: updateResult.error })
      return Result.Failure(couldNot("update game state"))
    }

    return Result.Success(true)
  }
}
