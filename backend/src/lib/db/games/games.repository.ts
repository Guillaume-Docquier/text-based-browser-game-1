import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { gamePlayerResourcesTable, gamePlayersTable, gamesTable, gameStatesTable, gameTicksTable, playersTable } from "#lib/db/schema.ts"
import { and, eq, getTableColumns } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { alias } from "drizzle-orm/pg-core"
import { couldNot } from "#lib/errors.ts"
import { computeNextTickDate } from "#tick-processing/processTick.ts"
import { ResourceType, STARTING_RESOURCE_AMOUNTS } from "#lib/gameResources.ts"

export type GameRow = typeof gamesTable.$inferSelect
export type GameRowInsert = typeof gamesTable.$inferInsert

export type GameSummaryPlayerRow = Pick<typeof playersTable.$inferSelect, "id" | "alias">

export type GameSummaryRow = Omit<GameRow, "createdByPlayerId"> & {
  creator: GameSummaryPlayerRow
  players: GameSummaryPlayerRow[]
}

const pgCreatorAlias = alias(playersTable, "creator")
const pgPlayerAlias = alias(playersTable, "player")

export class GamesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "games-repository" })
  }

  public async create(newGame: GameRowInsert, db: PostgresRepository["db"] = this.db): Promise<Result<GameRow, string>> {
    const createResult = await Result.tryCatch(
      async () =>
        await db.transaction(async (tx) => {
          const games = await tx.insert(gamesTable).values(newGame).returning()
          Assert.isTrue(games.length === 1)
          Assert.isDefined(games[0])

          const game = games[0]

          const joinGameResult = await this.join({ gameId: game.id, playerId: game.createdByPlayerId, canJoin: () => true }, tx)
          if (Result.isFailure(joinGameResult)) {
            this.logger.error("Could not join game after creating it, rolling back", { newGame, error: joinGameResult.error })
            tx.rollback() // Kinda sucks that we can't give any more info: https://github.com/drizzle-team/drizzle-orm/issues/1957
          }

          return game
        }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create game", { newGame, error: createResult.error })
      return Result.Failure(couldNot("create game"))
    }

    return createResult
  }

  public async getSummaries(db: PostgresRepository["db"] = this.db): Promise<Result<GameSummaryRow[], string>> {
    const gameSummariesResult = await Result.tryCatch(
      async () =>
        await db
          .select({
            // game info
            ...getTableColumns(gamesTable),

            // player info
            creatorId: pgCreatorAlias.id,
            creatorAlias: pgCreatorAlias.alias,

            playerId: pgPlayerAlias.id,
            playerAlias: pgPlayerAlias.alias,
          })
          .from(gamesTable)
          .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByPlayerId))
          .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
          .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId)),
    )

    if (Result.isFailure(gameSummariesResult)) {
      this.logger.error("Could not get game summaries", { error: gameSummariesResult.error })
      return Result.Failure(couldNot("get game summaries"))
    }

    const gameSummaries = gameSummariesResult.value

    // That is ugly af
    // Might need to learn proper sql here
    const dedupedGameIds = new Set()
    const dedupedGameSummaries = gameSummaries.filter((gameSummary) => {
      const isDuplicate = dedupedGameIds.has(gameSummary.id)
      dedupedGameIds.add(gameSummary.id)

      return !isDuplicate
    })

    return Result.Success(
      dedupedGameSummaries.map((gameSummary) => {
        const { creatorId, creatorAlias, playerId: _playerId, playerAlias: _playerAlias, ...gameInfo } = gameSummary

        return {
          ...gameInfo,
          creator: {
            id: creatorId,
            alias: creatorAlias,
          },
          players: gameSummaries
            .filter((row) => row.id === gameSummary.id && row.playerId !== null)
            .map((row) => ({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The filter above should have narrowed this type?
              id: row.playerId!,
              alias: row.playerAlias,
            })),
        }
      }),
    )
  }

  public async getSummaryById(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameSummaryRow | undefined, string>> {
    const gameSummariesResult = await Result.tryCatch(
      async () =>
        await db
          .select({
            // game info
            ...getTableColumns(gamesTable),

            // player info
            creatorId: pgCreatorAlias.id,
            creatorAlias: pgCreatorAlias.alias,

            playerId: pgPlayerAlias.id,
            playerAlias: pgPlayerAlias.alias,
          })
          .from(gamesTable)
          .innerJoin(pgCreatorAlias, eq(pgCreatorAlias.id, gamesTable.createdByPlayerId))
          .leftJoin(gamePlayersTable, eq(gamePlayersTable.gameId, gamesTable.id))
          .leftJoin(pgPlayerAlias, eq(pgPlayerAlias.id, gamePlayersTable.playerId))
          .where(eq(gamesTable.id, gameId)),
    )

    if (Result.isFailure(gameSummariesResult)) {
      this.logger.error("Could not get game summary by id", { gameId, error: gameSummariesResult.error })
      return Result.Failure(couldNot("get game summary by id"))
    }

    const gameSummary = gameSummariesResult.value[0]
    if (gameSummary === undefined) {
      return Result.Success(undefined)
    }

    const { creatorId, creatorAlias, playerId: _playerId, playerAlias: _playerAlias, ...gameInfo } = gameSummary

    return Result.Success({
      ...gameInfo,
      creator: {
        id: creatorId,
        alias: creatorAlias,
      },
      players: gameSummariesResult.value
        .filter((row) => row.playerId !== null)
        .map((row) => ({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The filter above should have narrowed this type?
          id: row.playerId!,
          alias: row.playerAlias,
        })),
    })
  }

  public async getPlayerIds({ gameId }: { gameId: number }, db: PostgresRepository["db"] = this.db): Promise<Result<number[], string>> {
    const gamePlayersResult = await Result.tryCatch(
      async () =>
        await db.select({ playerId: gamePlayersTable.playerId }).from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId)),
    )

    if (Result.isFailure(gamePlayersResult)) {
      this.logger.error("Could not get player ids", { gameId, error: gamePlayersResult.error })
      return Result.Failure(couldNot("get player ids"))
    }

    return Result.Success(gamePlayersResult.value.map(({ playerId }) => playerId))
  }

  public async hasPlayerJoinedGame(
    { gameId, playerId }: { gameId: number; playerId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const joinedGameResult = await Result.tryCatch(
      async () =>
        await db
          .select({ gameId: gamesTable.id, joinedPlayerId: gamePlayersTable.playerId })
          .from(gamesTable)
          .leftJoin(gamePlayersTable, and(eq(gamePlayersTable.gameId, gamesTable.id), eq(gamePlayersTable.playerId, playerId)))
          .where(eq(gamesTable.id, gameId)),
    )

    if (Result.isFailure(joinedGameResult)) {
      this.logger.error("Could not check if player joined game", { gameId, playerId, error: joinedGameResult.error })
      return Result.Failure(couldNot("check if player joined game"))
    }

    Assert.isTrue(joinedGameResult.value.length <= 1)
    return Result.Success(joinedGameResult.value[0]?.joinedPlayerId === playerId)
  }

  public async endWithWinner(
    { gameId, winnerPlayerId }: { gameId: number; winnerPlayerId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const endResult = await Result.tryCatch(async (): Promise<true> => {
      await db.update(gamesTable).set({ endedAt: new Date(), winnerPlayerId }).where(eq(gamesTable.id, gameId))

      return true
    })

    if (Result.isFailure(endResult)) {
      this.logger.error("Could not end game with winner", { gameId, winnerPlayerId, error: endResult.error })
      return Result.Failure(couldNot("end game with winner"))
    }

    return endResult
  }

  /**
   * Joins a game if `canJoin` allows it.
   */
  public async join(
    options: {
      gameId: number
      playerId: number
      canJoin: (gameSummaryRow: GameSummaryRow) => boolean
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const { gameId, playerId, canJoin } = options
    const joinResult = await Result.tryCatch(
      async () =>
        await db.transaction(async (tx): Promise<true> => {
          const gameSummaryRowResult = await this.getSummaryById({ gameId }, tx)
          if (Result.isFailure(gameSummaryRowResult)) {
            throw new Error(gameSummaryRowResult.error)
          }

          const gameSummaryRow = gameSummaryRowResult.value

          if (gameSummaryRow === undefined) {
            throw new Error(`Game does not exist, cannot join`)
          }

          if (!canJoin(gameSummaryRow)) {
            throw new Error(`canJoin returned false, the game will not be joined`)
          }

          await tx.insert(gamePlayersTable).values({ gameId, playerId })

          return true
        }),
    )

    if (Result.isFailure(joinResult)) {
      this.logger.error("Could not join game", { gameId, playerId, error: joinResult.error })
      return Result.Failure(couldNot("join game"))
    }

    return joinResult
  }

  /**
   * Leaves a game if `canLeave` allows it.
   * If the player is not in the game, a Success will be returned.
   */
  public async leave(
    {
      gameId,
      playerId,
      canLeave,
    }: {
      gameId: number
      playerId: number
      canLeave: (gameSummaryRow: GameSummaryRow) => boolean
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const leaveResult = await Result.tryCatch(
      async () =>
        await db.transaction(async (tx): Promise<true> => {
          const gameSummaryRowResult = await this.getSummaryById({ gameId }, tx)
          if (Result.isFailure(gameSummaryRowResult)) {
            throw new Error(gameSummaryRowResult.error)
          }

          const gameSummaryRow = gameSummaryRowResult.value
          if (gameSummaryRow === undefined) {
            throw new Error(`Game does not exist, cannot leave`)
          }

          if (!canLeave(gameSummaryRow)) {
            throw new Error(`canLeave returned false, the game will not be left`)
          }

          await tx.delete(gamePlayersTable).where(and(eq(gamePlayersTable.gameId, gameId), eq(gamePlayersTable.playerId, playerId)))

          return true
        }),
    )

    if (Result.isFailure(leaveResult)) {
      this.logger.error("Could not leave game", { gameId, playerId, error: leaveResult.error })
      return Result.Failure(couldNot("leave game"))
    }

    return leaveResult
  }

  /**
   * Starts a game if `canStart` allows it.
   * To start a game, we need to:
   * - Update the game start time
   * - Create a game state
   * - Schedule the tick
   */
  public async start(
    {
      gameId,
      canStart,
    }: {
      gameId: number
      canStart: (gameSummaryRow: GameSummaryRow) => boolean
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const startResult = await Result.tryCatch(
      async () =>
        await db.transaction(async (tx): Promise<true> => {
          const gameSummaryRowResult = await this.getSummaryById({ gameId }, tx)
          if (Result.isFailure(gameSummaryRowResult)) {
            throw new Error(gameSummaryRowResult.error)
          }

          const gameSummaryRow = gameSummaryRowResult.value
          if (gameSummaryRow === undefined) {
            throw new Error(`Game does not exist, cannot start`)
          }

          if (!canStart(gameSummaryRow)) {
            throw new Error(`canStart returned false, the game will not be started`)
          }

          // Update the game start time
          const startedAt = new Date()
          await tx
            .update(gamesTable)
            .set({ startedAt })
            .where(and(eq(gamesTable.id, gameId)))

          // Create the game state
          const nextTickAt = computeNextTickDate({ date: startedAt, tickIntervalSeconds: gameSummaryRow.tickIntervalSeconds })

          const gameStates = await tx.insert(gameStatesTable).values({ gameId, nextTickAt }).returning()
          Assert.isTrue(gameStates.length === 1)
          Assert.isDefined(gameStates[0])
          const gameState = gameStates[0]

          // Initialize starting resources for each player in the game.
          const gamePlayers = await tx.select().from(gamePlayersTable).where(eq(gamePlayersTable.gameId, gameId))

          await tx.insert(gamePlayerResourcesTable).values(
            gamePlayers.flatMap(({ gameId, playerId }) =>
              // Long term this should be data-driven, not hardcoded
              Object.values(ResourceType).map((resourceType) => ({
                gameId,
                playerId,
                resourceType,
                amount: STARTING_RESOURCE_AMOUNTS[resourceType],
              })),
            ),
          )

          // Schedule the next tick
          await tx.insert(gameTicksTable).values({ gameId, tick: gameState.tick, scheduledFor: gameState.nextTickAt })

          return true
        }),
    )

    if (Result.isFailure(startResult)) {
      this.logger.error("Could not start game", { gameId, error: startResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return startResult
  }
}
