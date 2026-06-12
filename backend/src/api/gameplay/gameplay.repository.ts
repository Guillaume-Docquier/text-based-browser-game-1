import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { LobbyModel, LobbyPlayerModel } from "#api/lobbies/lobbies.repository.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  accountsTable,
  gamePlayerActionsTable,
  gamePlayerResourcesTable,
  gamesTable,
  gameStatesTable,
  gameTicksTable,
  playersTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import type { GamePlayerActionType } from "#lib/gamePlayerActionType.ts"
import { ResourceType } from "#lib/gameResources.ts"

type GameRow = typeof gamesTable.$inferSelect
type NewGameStateRow = typeof gameStatesTable.$inferInsert
type GameStateRow = typeof gameStatesTable.$inferSelect
type GamePlayerActionRow = typeof gamePlayerActionsTable.$inferSelect
type NewGamePlayerResourceRow = typeof gamePlayerResourcesTable.$inferInsert

export type GameStateModel = GameStateRow
export type GamePlayerActionModel = GamePlayerActionRow
export type PlayerGameStateModel = GameStateModel & {
  playerId: PlayerId
  resources: {
    money: number
  }
}

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
  }

  public async getLobbyById(
    { gameId }: { gameId: GameId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<LobbyModel | undefined, string>> {
    const gameRowResult = await Result.tryCatch(db.select().from(gamesTable).where(eq(gamesTable.id, gameId)))
    if (Result.isFailure(gameRowResult)) {
      this.logger.error("Failed to get game", { gameId, error: gameRowResult.error })
      return Result.Failure(couldNot("get game"))
    }
    Assert.isTrue(gameRowResult.value.length <= 1)

    const gameRow = gameRowResult.value[0]
    if (gameRow === undefined) {
      return Result.Success(undefined)
    }

    const playersResult = await Result.tryCatch(
      db
        .select({
          id: playersTable.playerId,
          alias: accountsTable.alias,
        })
        .from(playersTable)
        .innerJoin(accountsTable, eq(accountsTable.id, playersTable.playerId))
        .where(eq(playersTable.gameId, gameId)),
    )
    if (Result.isFailure(playersResult)) {
      this.logger.error("Failed to get players in the lobby", { gameId, error: playersResult.error })
      return Result.Failure(couldNot("get players in the lobby"))
    }

    return Result.Success(toLobbyModel({ gameRow, players: playersResult.value }))
  }

  public async updateGame(
    { gameId }: { gameId: GameId },
    game: Partial<GameRow>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(db.update(gamesTable).set(game).where(eq(gamesTable.id, gameId)))

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game", { gameId, game, error: updateResult.error })
      return Result.Failure(couldNot("update game"))
    }

    return Result.Success(true)
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

  public async createGameState(
    newGameState: NewGameStateRow,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameStateModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const gameStates = await db.insert(gameStatesTable).values(newGameState).returning()
      Assert.isTrue(gameStates.length === 1)
      Assert.isDefined(gameStates[0])

      return gameStates[0]
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game state", { newGameState, error: createResult.error })
      return Result.Failure(couldNot("create game state"))
    }

    return createResult
  }

  public async createStartingResources(
    newGamePlayerResources: NewGamePlayerResourceRow[],
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    if (newGamePlayerResources.length === 0) {
      return Result.Success(true)
    }

    const createResult = await Result.tryCatch(db.insert(gamePlayerResourcesTable).values(newGamePlayerResources))
    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create starting resources", { newGamePlayerResources, error: createResult.error })
      return Result.Failure(couldNot("create starting resources"))
    }

    return Result.Success(true)
  }

  public async createGameTick(
    newGameTick: typeof gameTicksTable.$inferInsert,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(db.insert(gameTicksTable).values(newGameTick))
    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game tick", { newGameTick, error: createResult.error })
      return Result.Failure(couldNot("create game tick"))
    }

    return Result.Success(true)
  }

  public async getPlayerGameState(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerGameStateModel | undefined, string>> {
    const playerGameStateResult = await Result.tryCatch(
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

    if (Result.isFailure(playerGameStateResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerGameStateResult.error })
      return Result.Failure(couldNot("get player game state by ids"))
    }

    return playerGameStateResult
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

function toLobbyModel({ gameRow, players }: { gameRow: GameRow; players: LobbyPlayerModel[] }): LobbyModel {
  const creator = players.find((player) => player.id === gameRow.createdByAccountId)
  Assert.isDefined(creator)

  return {
    id: gameRow.id,
    createdAt: gameRow.createdAt,
    startedAt: gameRow.startedAt,
    endedAt: gameRow.endedAt,
    winnerAccountId: gameRow.winnerAccountId,
    configuration: {
      name: gameRow.name,
      nbSeats: gameRow.nbSeats,
      tickIntervalSeconds: gameRow.tickIntervalSeconds,
      starSystemGenerationSettings: gameRow.starSystemGenerationSettings,
    },
    creator,
    players,
  }
}
