import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#api/games/GameId.ts"
import { gameSettingsTable, gamesTable, playersTable } from "#lib/db/schema.ts"
import { and, eq } from "drizzle-orm"
import { couldNot } from "#lib/errors.ts"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { StarSystemGenerationSettings } from "#lib/star-systems/StarSystemGenerationSettings.ts"
import type { PlayerId } from "#api/games/PlayerId.ts"

export type CreateGameLobbyModel = {
  createdByAccountId: AccountId
  settings: {
    name: string
    nbSeats: number
    tickIntervalSeconds: number
    starSystemGenerationSettings: StarSystemGenerationSettings
  }
}

export class GameLobbiesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "game-lobbies-repository" })
  }

  public async createGameLobby(
    createGameLobbyModel: CreateGameLobbyModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ createdGameId: GameId }, string>> {
    const createGameLobbyResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx.insert(gamesTable).values({ createdByAccountId: createGameLobbyModel.createdByAccountId }).returning()
        Assert.isTrue(games.length === 1)
        Assert.isDefined(games[0])
        const game = games[0]

        await tx.insert(gameSettingsTable).values({ ...createGameLobbyModel.settings, gameId: game.id })
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

  public async joinGameLobby(
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

  public async leaveGameLobby(
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

  public async hasAccountJoinedGame(
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
