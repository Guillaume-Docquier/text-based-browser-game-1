import { Assert, type Branded, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { type GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import { type PlayerColor } from "#lib/db/PlayerColor.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable, gamesTable, playersTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

type CreateGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect

export type LobbyConfigurationModel = {
  name: string
  nbSeats: number
  turnIntervalSeconds: number
}

export type CreateLobbyModel = {
  createdByAccountId: AccountId
  mapGenerationSeed: number
  status: GameStatus
  configuration: LobbyConfigurationModel
  creatorPlayerColor: PlayerColor
}

export type LobbyModel = {
  id: GameId
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  winnerAccountId: AccountId | null
  status: GameStatus
  configuration: LobbyConfigurationModel
  creator: LobbyPlayerModel
  players: LobbyPlayerModel[]
}

export type LobbyPlayerModel = {
  id: PlayerId
  alias: string | null
  color: PlayerColor
}

type PlayerForJoin = {
  id: PlayerId
  color: PlayerColor
}

/**
 * Owning a LobbyForJoin within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be joined, you have to check the state and decide.
 */
export type LobbyForJoin = Branded<
  {
    readonly id: GameId
    readonly status: GameStatus
    readonly nbSeats: number
    readonly players: readonly PlayerForJoin[]
  },
  "LobbyForJoin"
>

export type JoinLobbyModel = {
  /**
   * The LobbyForJoin must be acquired in the same transaction.
   */
  readonly lobby: LobbyForJoin
  readonly accountId: AccountId
  readonly color: PlayerColor
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS | typeof GameStatus.READY_TO_START
}

/**
 * Owning a LobbyForLeave within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be left, you have to check the state and decide.
 */
export type LobbyForLeave = Branded<
  {
    readonly id: GameId
    readonly status: GameStatus
    readonly createdByAccountId: AccountId
    readonly playerIds: readonly PlayerId[]
  },
  "LobbyForLeave"
>

export type LeaveLobbyModel = {
  /**
   * The LobbyForLeave must be acquired in the same transaction.
   */
  readonly lobby: LobbyForLeave
  readonly accountId: AccountId
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS
}

export class LobbiesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "lobbies-repository" })
  }

  public async createLobby(
    createLobbyModel: CreateLobbyModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ createdGameId: GameId }, string>> {
    const createLobbyResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx.insert(gamesTable).values(toCreateGameRow(createLobbyModel)).returning()
        Assert.isTrue(games.length === 1)
        Assert.isDefined(games[0])
        const game = games[0]

        await tx.insert(playersTable).values({
          gameId: game.id,
          playerId: createLobbyModel.createdByAccountId,
          color: createLobbyModel.creatorPlayerColor,
        })

        return { createdGameId: game.id }
      }),
    )

    if (Result.isFailure(createLobbyResult)) {
      this.logger.error("Could not create game lobby", { createLobbyModel, error: createLobbyResult.error })
      return Result.Failure(couldNot("create game lobby"))
    }

    return createLobbyResult
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
          color: playersTable.color,
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

  public async getLobbyForJoin({ gameId }: { gameId: GameId }, tx: Transaction): Promise<Result<LobbyForJoin, string>> {
    const games = await tx
      .select({ id: gamesTable.id, status: gamesTable.status, nbSeats: gamesTable.nbSeats })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(games.length <= 1)

    const game = games[0]
    if (game === undefined) {
      return Result.Failure("The lobby does not exist.")
    }

    const playerRows: readonly PlayerForJoin[] = await tx
      .select({
        id: playersTable.playerId,
        color: playersTable.color,
      })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId))

    return Result.Success(
      branded<LobbyForJoin>({
        ...game,
        players: playerRows,
      }),
    )
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async joinLobby({ lobby, accountId, color, status }: JoinLobbyModel, tx: Transaction): Promise<{ playerId: PlayerId }> {
    const gamePlayers = await tx.insert(playersTable).values({ gameId: lobby.id, playerId: accountId, color }).returning()
    Assert.isTrue(gamePlayers.length === 1)
    Assert.isDefined(gamePlayers[0])

    if (status !== lobby.status) {
      const updatedGames = await tx.update(gamesTable).set({ status }).where(eq(gamesTable.id, lobby.id)).returning()
      Assert.isTrue(updatedGames.length === 1)
    }

    return { playerId: gamePlayers[0].playerId }
  }

  public async getLobbyForLeave({ gameId }: { gameId: GameId }, tx: Transaction): Promise<Result<LobbyForLeave, string>> {
    const games = await tx
      .select({ id: gamesTable.id, status: gamesTable.status, createdByAccountId: gamesTable.createdByAccountId })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(games.length <= 1)

    const game = games[0]
    if (game === undefined) {
      return Result.Failure("The lobby does not exist.")
    }

    const playerRows = await tx.select({ playerId: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId))

    return Result.Success(
      branded<LobbyForLeave>({
        ...game,
        playerIds: playerRows.map(({ playerId }) => playerId),
      }),
    )
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async leaveLobby({ lobby, accountId, status }: LeaveLobbyModel, tx: Transaction): Promise<void> {
    const deletedPlayers = await tx
      .delete(playersTable)
      .where(and(eq(playersTable.gameId, lobby.id), eq(playersTable.playerId, accountId)))
      .returning()
    Assert.isTrue(deletedPlayers.length === 1)

    if (status !== lobby.status) {
      const updatedGames = await tx.update(gamesTable).set({ status }).where(eq(gamesTable.id, lobby.id)).returning()
      Assert.isTrue(updatedGames.length === 1)
    }
  }
}

function toCreateGameRow(createLobbyModel: CreateLobbyModel): CreateGameRow {
  return {
    createdByAccountId: createLobbyModel.createdByAccountId,
    mapGenerationSeed: createLobbyModel.mapGenerationSeed,
    status: createLobbyModel.status,
    ...createLobbyModel.configuration,
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
    status: gameRow.status,
    configuration: {
      name: gameRow.name,
      nbSeats: gameRow.nbSeats,
      turnIntervalSeconds: gameRow.turnIntervalSeconds,
    },
    creator,
    players,
  }
}
