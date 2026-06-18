import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { accountsTable, gamesTable, playersTable } from "#lib/db/schema.ts"
import type { StarSystemGenerationSettings } from "#lib/db/star-systems/StarSystemGenerationSettings.ts"
import { couldNot } from "#lib/errors.ts"

type CreateGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect

export type LobbyConfigurationModel = {
  name: string
  nbSeats: number
  tickIntervalSeconds: number
  starSystemGenerationSettings: StarSystemGenerationSettings
}

export type CreateLobbyModel = {
  createdByAccountId: AccountId
  configuration: LobbyConfigurationModel
}

export type LobbyModel = {
  id: GameId
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  winnerAccountId: AccountId | null
  configuration: LobbyConfigurationModel
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
    createLobbyModel: CreateLobbyModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ createdGameId: GameId }, string>> {
    const createLobbyResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx.insert(gamesTable).values(toCreateGameRow(createLobbyModel)).returning()
        Assert.isTrue(games.length === 1)
        Assert.isDefined(games[0])
        const game = games[0]

        await tx.insert(playersTable).values({ gameId: game.id, playerId: game.createdByAccountId })

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

  public async joinLobby(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ playerId: PlayerId }, string>> {
    const joinLobbyResult = await Result.tryCatch(async () => {
      const gamePlayers = await db.insert(playersTable).values({ gameId, playerId: accountId }).returning()
      Assert.isTrue(gamePlayers.length === 1)
      Assert.isDefined(gamePlayers[0])

      return { playerId: gamePlayers[0].playerId }
    })

    if (Result.isFailure(joinLobbyResult)) {
      this.logger.error("Could not join game lobby", { gameId, accountId, error: joinLobbyResult.error })
      return Result.Failure(couldNot("join game lobby"))
    }

    return joinLobbyResult
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

function toCreateGameRow(createLobbyModel: CreateLobbyModel): CreateGameRow {
  return {
    createdByAccountId: createLobbyModel.createdByAccountId,
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
