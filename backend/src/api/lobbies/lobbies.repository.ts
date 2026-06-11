import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq, inArray } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/games/GameId.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable, gamesTable, playersTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import type { StarSystemGenerationSettings } from "#lib/star-systems/StarSystemGenerationSettings.ts"

type CreateGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect

export type GameConfiguration = {
  name: string
  nbSeats: number
  tickIntervalSeconds: number
  starSystemGenerationSettings: StarSystemGenerationSettings
}

export type CreateLobbyModel = {
  createdByAccountId: AccountId
  configuration: GameConfiguration
}

export type LobbyModel = {
  id: GameId
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  winnerAccountId: AccountId | null
  configuration: GameConfiguration
  creator: LobbyPlayerModel
  players: LobbyPlayerModel[]
}

export type LobbyPlayerModel = {
  id: PlayerId
  alias: string | null
}

export class LobbiesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "lobbies-repository" })
  }

  public async createLobby(
    createGameLobbyModel: CreateLobbyModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ createdGameId: GameId }, string>> {
    const createGameLobbyResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx.insert(gamesTable).values(toCreateGameRow(createGameLobbyModel)).returning()
        Assert.isTrue(games.length === 1)
        Assert.isDefined(games[0])
        const game = games[0]

        await tx.insert(playersTable).values({ gameId: game.id, playerId: game.createdByAccountId })

        return { createdGameId: game.id }
      }),
    )

    if (Result.isFailure(createGameLobbyResult)) {
      this.logger.error("Could not create game lobby", { createGameLobbyModel, error: createGameLobbyResult.error })
      return Result.Failure(couldNot("create game lobby"))
    }

    return createGameLobbyResult
  }

  /**
   * Gets ALL the game lobbies. This only makes sense until we have real traffic.
   */
  public async getLobbies(db: PostgresRepository["db"] = this.db): Promise<Result<LobbyModel[], string>> {
    const gameRowsResult = await Result.tryCatch(db.select().from(gamesTable))
    if (Result.isFailure(gameRowsResult)) {
      this.logger.error("Failed to get games", { error: gameRowsResult.error })
      return Result.Failure(couldNot("get games"))
    }

    const gameIds = gameRowsResult.value.map(({ id }) => id)
    const playersResult = await Result.tryCatch(
      db
        .select({
          gameId: playersTable.gameId,
          id: playersTable.playerId,
          alias: accountsTable.alias,
        })
        .from(playersTable)
        .innerJoin(accountsTable, eq(accountsTable.id, playersTable.playerId))
        .where(inArray(playersTable.gameId, gameIds)),
    )
    if (Result.isFailure(playersResult)) {
      this.logger.error("Failed to get players in the lobbies", { error: playersResult.error })
      return Result.Failure(couldNot("get players in the lobbies"))
    }

    const playersByGameId = Map.groupBy(playersResult.value, (player) => player.gameId)

    return Result.Success(
      gameRowsResult.value.map((gameRow) => ({ gameRow, players: playersByGameId.get(gameRow.id) ?? [] })).map(toGameLobbyModel),
    )
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

    return Result.Success(toGameLobbyModel({ gameRow, players: playersResult.value }))
  }

  public async joinLobby(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ playerId: PlayerId }, string>> {
    const joinGameLobbyResult = await Result.tryCatch(async () => {
      const gamePlayers = await db.insert(playersTable).values({ gameId, playerId: accountId }).returning()
      Assert.isTrue(gamePlayers.length === 1)
      Assert.isDefined(gamePlayers[0])

      return { playerId: gamePlayers[0].playerId }
    })

    if (Result.isFailure(joinGameLobbyResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinGameLobbyResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinGameLobbyResult
  }

  public async leaveLobby(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      db.delete(playersTable).where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, accountId))),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not leave game lobby", { gameId, accountId, error: deleteResult.error })
      return Result.Failure(couldNot("leave game lobby"))
    }

    return Result.Success(true)
  }

  public async hasAccountJoinedLobby(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const joinedGameResult = await Result.tryCatch(async () => {
      const rows = await db
        .select({ playerId: playersTable.playerId })
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, accountId)))
      Assert.isTrue(rows.length <= 1)

      return rows.length === 1
    })

    if (Result.isFailure(joinedGameResult)) {
      this.logger.error("Could not check if player joined game", { gameId, accountId, error: joinedGameResult.error })
      return Result.Failure(couldNot("check if player joined game"))
    }

    return joinedGameResult
  }
}

function toCreateGameRow(createGameLobbyModel: CreateLobbyModel): CreateGameRow {
  return {
    createdByAccountId: createGameLobbyModel.createdByAccountId,
    ...createGameLobbyModel.configuration,
  }
}

function toGameLobbyModel({ gameRow, players }: { gameRow: GameRow; players: LobbyPlayerModel[] }): LobbyModel {
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
