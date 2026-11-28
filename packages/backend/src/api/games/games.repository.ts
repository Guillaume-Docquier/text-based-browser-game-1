import {
  Assert,
  type Branded,
  branded,
  type Enumify,
  type Logger,
  Result,
  Time,
  UnitOfTime,
  type RngState,
} from "@guillaume-docquier/tools-ts"
import { and, count, eq, sql } from "drizzle-orm"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { GameConfiguration } from "shared/domain/games/GameConfiguration.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { Player } from "shared/domain/players/Player.ts"
import type { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { Building } from "shared/domain/world/buildings/Building.ts"
import type { Galaxy } from "shared/domain/world/Galaxy.ts"
import type { Ship } from "shared/domain/world/ships/Ship.ts"
import type { GameCreationConfirmation } from "#api/games/GameCreationConfirmation.ts"
import type { GameDetails } from "#api/games/GameDetails.ts"
import { GetGameByIdError } from "#api/games/getGameById.error.ts"
import { GetGameListingsError } from "#api/games/getGameListings.error.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { PlanetObservationsRepository } from "#lib/db/planetObservations.repository.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  accountsTable,
  gamesTable,
  playersTable,
  turnsTable,
  turnsProcessingTable,
  starsTable,
  planetsTable,
  buildingsTable,
  shipsTable,
} from "#lib/db/schema.ts"
import { CreateGameError } from "./createGame.error.ts"
import { JoinGameError, JoinGameRollbackError } from "./joinGame.error.ts"
import { LeaveGameError, LeaveGameRollbackError } from "./leaveGame.error.ts"
import { StartGameError, StartGameRollbackError } from "./startGame.error.ts"

type GetPlayerIdError = Enumify<typeof GetPlayerIdError>
const GetPlayerIdError = {
  UNKNOWN: "UNKNOWN",
} as const

type NewTurnRow = typeof turnsTable.$inferInsert
type NewTurnProcessingRow = typeof turnsProcessingTable.$inferInsert

type CreateGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect

export type CreateGameConfigurationModel = Omit<GameConfiguration, "mapGenerationSeed">

export type CreateGameModel = Readonly<{
  createdByAccountId: AccountId
  mapGenerationSeed: number
  status: GameStatus
  configuration: CreateGameConfigurationModel
  creatorPlayerColor: PlayerColor
}>

export type GameDetailsWithoutOps = Omit<GameDetails, "canJoin" | "canLeave" | "canOpen" | "canStart">

type PlayerForJoin = Readonly<{
  id: PlayerId
  color: PlayerColor
}>

export type GameForJoin = Branded<
  "GameForJoin",
  {
    readonly gameId: GameId
    readonly status: GameStatus
    readonly nbSeats: number
    readonly players: readonly PlayerForJoin[]
  }
>

export type JoinGameModel = {
  readonly context: GameForJoin
  readonly playerId: PlayerId
  readonly color: PlayerColor
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS | typeof GameStatus.READY_TO_START
}

export type GameForLeave = Branded<
  "GameForLeave",
  {
    readonly gameId: GameId
    readonly status: GameStatus
    readonly createdByAccountId: AccountId
    readonly playerIds: readonly PlayerId[]
  }
>

export type LeaveGameModel = {
  readonly context: GameForLeave
  readonly playerId: PlayerId
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS
}

export type GameForStart = Branded<
  "GameForStart",
  {
    readonly gameId: GameId
    readonly createdByAccountId: AccountId
    readonly mapGenerationSeed: number
    readonly status: GameStatus
    readonly turnInterval: Time
    readonly playerIds: readonly PlayerId[]
  }
>

export type StartGameModel = {
  readonly startingCredits: number
  readonly context: GameForStart
  readonly status: GameStatus
  readonly startedAt: Date
  readonly turnEndsAt: Date
  readonly rngState: RngState<number>
  readonly ships: readonly Ship[]
  readonly buildings: ReadonlyArray<Omit<Building, "id">>
  readonly galaxy: Galaxy
}

export type GameListingModel = {
  id: GameId
  name: string
  hasJoined: boolean
  nbPlayers: number
  nbSeats: number
  status: GameStatus
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

// CONSTRAINT: Postgres has a limit of 32767 (int16) bind parameters for a query. We hit it as we insert 3000+ planets with 15+ attributes each, leading to 45k+ bind parameters.
const PLANET_INSERT_BATCH_SIZE = 1_000

export class GamesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "games-repository" })
  }

  public async getPlayerId(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerId | undefined, GetPlayerIdError>> {
    const playerIdResult = await Result.tryCatch(async () => {
      const rows = await db
        .select({ playerId: playersTable.playerId })
        .from(playersTable)
        .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, branded(accountId))))
      Assert.isTrue(rows.length <= 1)

      return rows[0]?.playerId
    })

    if (Result.isFailure(playerIdResult)) {
      this.logger.error("Could not check if player joined game", { gameId, accountId, error: playerIdResult.error })
      return Result.Failure(GetPlayerIdError.UNKNOWN)
    }

    return playerIdResult
  }

  public async getGameForStart({ gameId }: { gameId: GameId }, tx: Transaction): Promise<GameForStart> {
    const gamesForStart = await tx
      .select({
        id: gamesTable.id,
        createdByAccountId: gamesTable.createdByAccountId,
        mapGenerationSeed: gamesTable.mapGenerationSeed,
        status: gamesTable.status,
        turnIntervalSeconds: gamesTable.turnIntervalSeconds,
      })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(gamesForStart.length <= 1)

    const gameForStart = gamesForStart[0]
    if (gameForStart === undefined) {
      throw new StartGameRollbackError(StartGameError.GAME_NOT_FOUND)
    }

    const playerIdRows = await tx
      .select({ playerId: playersTable.playerId })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameForStart.id))
    Assert.isTrue(playerIdRows.length > 0)

    const playerIds: readonly PlayerId[] = playerIdRows.map(({ playerId }) => playerId)

    return branded({
      gameId: gameForStart.id,
      createdByAccountId: gameForStart.createdByAccountId,
      mapGenerationSeed: gameForStart.mapGenerationSeed,
      status: gameForStart.status,
      turnInterval: Time.create(gameForStart.turnIntervalSeconds, UnitOfTime.SECONDS),
      playerIds,
    })
  }

  public async startGame(startGameModel: StartGameModel, tx: Transaction): Promise<void> {
    const gameTurn: NewTurnRow = {
      gameId: startGameModel.context.gameId,
      turn: 1,
      status: TurnStatus.COLLECTING_ACTIONS,
      startedAt: startGameModel.startedAt,
      endsAt: startGameModel.turnEndsAt,
      rngGeneratorState: startGameModel.rngState.generatorState,
      rngSpareNormal: startGameModel.rngState.spareNormal,
    }

    const turnProcessing: NewTurnProcessingRow = {
      gameId: startGameModel.context.gameId,
      turn: gameTurn.turn,
      scheduledFor: gameTurn.endsAt,
    }

    const stars = startGameModel.galaxy.systems.map(({ star }) => ({
      gameId: startGameModel.context.gameId,
      ...star,
    }))
    const planets = startGameModel.galaxy.systems.flatMap(({ star, planets: systemPlanets }) =>
      systemPlanets.map((planet) => ({
        gameId: startGameModel.context.gameId,
        starId: star.id,
        ...planet,
      })),
    )

    const updatedGames = await tx
      .update(gamesTable)
      .set({ startedAt: startGameModel.startedAt, status: startGameModel.status })
      .where(and(eq(gamesTable.id, startGameModel.context.gameId)))
      .returning({ id: gamesTable.id })
    Assert.isTrue(updatedGames.length === 1)

    await tx
      .update(playersTable)
      .set({ creditBalance: startGameModel.startingCredits })
      .where(eq(playersTable.gameId, startGameModel.context.gameId))
    await tx.insert(turnsTable).values(gameTurn)
    await tx.insert(turnsProcessingTable).values(turnProcessing)
    await tx.insert(starsTable).values(stars)
    for (let index = 0; index < planets.length; index += PLANET_INSERT_BATCH_SIZE) {
      await tx.insert(planetsTable).values(planets.slice(index, index + PLANET_INSERT_BATCH_SIZE))
    }
    await tx.insert(shipsTable).values(startGameModel.ships.map((ship) => ({ ...ship, gameId: startGameModel.context.gameId })))
    await tx
      .insert(buildingsTable)
      .values(startGameModel.buildings.map((building) => ({ ...building, gameId: startGameModel.context.gameId })))
    await new PlanetObservationsRepository(tx).saveCurrentObservations(gameTurn.gameId, gameTurn.turn)
  }

  public async getGameListings(
    { accountId }: { accountId: AccountId | undefined },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameListingModel[], GetGameListingsError>> {
    const listingsResult: Result<GameListingModel[], Error> = await Result.tryCatch(
      db
        .select({
          id: gamesTable.id,
          name: gamesTable.name,
          hasJoined:
            accountId === undefined
              ? sql<boolean>`false`
              : sql<boolean>`count(*) filter (where ${playersTable.playerId} = ${accountId}) > 0`,
          nbPlayers: count(playersTable.playerId),
          nbSeats: gamesTable.nbSeats,
          createdAt: gamesTable.createdAt,
          startedAt: gamesTable.startedAt,
          endedAt: gamesTable.endedAt,
          status: gamesTable.status,
        })
        .from(gamesTable)
        .leftJoin(playersTable, eq(playersTable.gameId, gamesTable.id))
        .groupBy(gamesTable.id),
    )
    if (Result.isFailure(listingsResult)) {
      this.logger.error("Failed to get game listings", { error: listingsResult.error })
      return Result.Failure(GetGameListingsError.UNKNOWN)
    }

    return listingsResult
  }

  public async createGame(
    createGameModel: CreateGameModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameCreationConfirmation, CreateGameError>> {
    const createGameResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const games = await tx.insert(gamesTable).values(toCreateGameRow(createGameModel)).returning()
        Assert.isTrue(games.length === 1)
        Assert.isDefined(games[0])
        const game = games[0]

        await tx.insert(playersTable).values({
          gameId: game.id,
          playerId: branded(createGameModel.createdByAccountId),
          color: createGameModel.creatorPlayerColor,
        })

        return { createdGameId: game.id }
      }),
    )

    if (Result.isFailure(createGameResult)) {
      this.logger.error("Could not create game lobby", { createGameModel, error: createGameResult.error })
      return Result.Failure(CreateGameError.UNKNOWN)
    }

    return createGameResult
  }

  public async getGameDetails(
    { gameId }: { gameId: GameId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameDetailsWithoutOps, GetGameByIdError>> {
    const gameRowResult = await Result.tryCatch(db.select().from(gamesTable).where(eq(gamesTable.id, gameId)))
    if (Result.isFailure(gameRowResult)) {
      this.logger.error("Failed to get game", { gameId, error: gameRowResult.error })
      return Result.Failure(GetGameByIdError.UNKNOWN)
    }
    Assert.isTrue(gameRowResult.value.length <= 1)

    const gameRow = gameRowResult.value[0]
    if (gameRow === undefined) {
      this.logger.error("No game found", { gameId })
      return Result.Failure(GetGameByIdError.GAME_NOT_FOUND)
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
      this.logger.error("Failed to get players in the game", { gameId, error: playersResult.error })
      return Result.Failure(GetGameByIdError.FAILED_TO_GET_PLAYERS)
    }

    return Result.Success(toGameDetailsWithoutOps({ gameRow, players: playersResult.value }))
  }

  public async getGameForJoin({ gameId }: { gameId: GameId }, tx: Transaction): Promise<GameForJoin> {
    const games = await tx
      .select({ gameId: gamesTable.id, status: gamesTable.status, nbSeats: gamesTable.nbSeats })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(games.length <= 1)

    const game = games[0]
    if (game === undefined) {
      throw new JoinGameRollbackError(JoinGameError.GAME_NOT_FOUND)
    }

    const playerRows: readonly PlayerForJoin[] = await tx
      .select({
        id: playersTable.playerId,
        color: playersTable.color,
      })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId))

    return branded({
      ...game,
      players: playerRows,
    })
  }

  public async joinGame({ context, playerId, color, status }: JoinGameModel, tx: Transaction): Promise<void> {
    const gamePlayers = await tx.insert(playersTable).values({ gameId: context.gameId, playerId, color }).returning()
    Assert.isTrue(gamePlayers.length === 1)

    if (status !== context.status) {
      const updatedGames = await tx.update(gamesTable).set({ status }).where(eq(gamesTable.id, context.gameId)).returning()
      Assert.isTrue(updatedGames.length === 1)
    }
  }

  public async getGameForLeave({ gameId }: { gameId: GameId }, tx: Transaction): Promise<GameForLeave> {
    const games = await tx
      .select({ gameId: gamesTable.id, status: gamesTable.status, createdByAccountId: gamesTable.createdByAccountId })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(games.length <= 1)

    const game = games[0]
    if (game === undefined) {
      throw new LeaveGameRollbackError(LeaveGameError.GAME_NOT_FOUND)
    }

    const playerRows = await tx.select({ playerId: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId))

    return branded({
      ...game,
      playerIds: playerRows.map(({ playerId }) => playerId),
    })
  }

  public async leaveGame({ context, playerId, status }: LeaveGameModel, tx: Transaction): Promise<void> {
    const deletedPlayers = await tx
      .delete(playersTable)
      .where(and(eq(playersTable.gameId, context.gameId), eq(playersTable.playerId, playerId)))
      .returning()
    Assert.isTrue(deletedPlayers.length === 1)

    if (status !== context.status) {
      const updatedGames = await tx.update(gamesTable).set({ status }).where(eq(gamesTable.id, context.gameId)).returning()
      Assert.isTrue(updatedGames.length === 1)
    }
  }
}

function toCreateGameRow(createGameModel: CreateGameModel): CreateGameRow {
  return {
    createdByAccountId: createGameModel.createdByAccountId,
    mapGenerationSeed: createGameModel.mapGenerationSeed,
    status: createGameModel.status,
    ...createGameModel.configuration,
  }
}

function toGameDetailsWithoutOps({ gameRow, players }: { gameRow: GameRow; players: Player[] }): GameDetailsWithoutOps {
  const creator = players.find((player) => player.id === branded(gameRow.createdByAccountId))
  Assert.isDefined(creator)

  return {
    id: gameRow.id,
    createdAt: gameRow.createdAt,
    startedAt: gameRow.startedAt,
    endedAt: gameRow.endedAt,
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
