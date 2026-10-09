import { Assert, type Branded, branded, type Logger, Result, Time, UnitOfTime, type RngState } from "@guillaume-docquier/tools-ts"
import { and, count, eq, sql } from "drizzle-orm"
import type { AccountId } from "shared/domain/accounts/AccountId.ts"
import type { Alias } from "shared/domain/accounts/Alias.ts"
import type { GameConfiguration } from "shared/domain/games/GameConfiguration.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { GameStatus } from "shared/domain/games/GameStatus.ts"
import type { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import type { RulesetId } from "shared/domain/ruleset/RulesetId.ts"
import type { AvailableAction } from "shared/domain/turns/actions/Action.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { Galaxy } from "shared/domain/world/Galaxy.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  accountsTable,
  gamesTable,
  playersTable,
  rulesetsTable,
  actionsTable,
  turnsTable,
  turnsProcessingTable,
  resourcesTable,
  starsTable,
  planetsTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

type NewActionRow = typeof actionsTable.$inferInsert
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTurnRow = typeof turnsTable.$inferInsert
type NewTurnProcessingRow = typeof turnsProcessingTable.$inferInsert

type CreateGameRow = typeof gamesTable.$inferInsert
type GameRow = typeof gamesTable.$inferSelect

export type RulesetSummaryModel = Pick<Ruleset, "id" | "name" | "isDefault">

export type GameCreationSettingsModel = Readonly<{
  rulesets: readonly RulesetSummaryModel[]
}>

export type CreateGameConfigurationModel = Omit<GameConfiguration, "mapGenerationSeed">

export type GameConfigurationDetailsModel = Readonly<{
  name: string
  nbSeats: number
  turnIntervalSeconds: number
  ruleset: RulesetSummaryModel
}>

export type CreateGameModel = Readonly<{
  createdByAccountId: AccountId
  mapGenerationSeed: number
  status: GameStatus
  configuration: CreateGameConfigurationModel
  creatorPlayerColor: PlayerColor
}>

export type GameDetailsModel = Readonly<{
  id: GameId
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
  winnerAccountId: AccountId | null
  status: GameStatus
  configuration: GameConfigurationDetailsModel
  creator: GamePlayerModel
  players: readonly GamePlayerModel[]
}>

export type GamePlayerModel = Readonly<{
  id: PlayerId
  alias: Alias
  color: PlayerColor
}>

type PlayerForJoin = Readonly<{
  id: PlayerId
  color: PlayerColor
}>

/**
 * Owning a GameForJoin within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be joined, you have to check the state and decide.
 */
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
  /**
   * The GameForJoin must be acquired in the same transaction.
   */
  readonly context: GameForJoin
  readonly playerId: PlayerId
  readonly color: PlayerColor
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS | typeof GameStatus.READY_TO_START
}

/**
 * Owning a GameForLeave within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be left, you have to check the state and decide.
 */
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
  /**
   * The GameForLeave must be acquired in the same transaction.
   */
  readonly context: GameForLeave
  readonly playerId: PlayerId
  readonly status: typeof GameStatus.WAITING_FOR_PLAYERS
}

/**
 * Owning a GameForStart within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be started, you have to check the state and decide.
 */
export type GameForStart = Branded<
  "GameForStart",
  {
    readonly gameId: GameId
    readonly createdByAccountId: AccountId
    readonly mapGenerationSeed: number
    readonly status: GameStatus
    readonly turnInterval: Time
    readonly playerIds: readonly PlayerId[]
    readonly ruleset: Ruleset
  }
>

export type StartGameModel = {
  /**
   * The GameForStart must be acquired in the same transaction
   */
  readonly context: GameForStart
  readonly status: GameStatus
  readonly startedAt: Date
  /**
   * When the first turn should end
   */
  readonly turnEndsAt: Date
  /**
   * The rng state to use for the first turn's processing
   */
  readonly rngState: RngState<number>
  readonly playerResources: ReadonlyArray<{
    readonly playerId: PlayerId
    readonly resourceType: ResourceType
    readonly amount: number
  }>
  /**
   * Eventually will probably be per player, might not all have the same starting conditions
   */
  readonly availableActions: readonly AvailableAction[]
  readonly galaxy: Galaxy
}

export type GameListingModel = {
  id: GameId
  name: string
  /**
   * True if the account requesting the listing has joined the game.
   * Always false for anonymous users.
   */
  hasJoined: boolean
  nbPlayers: number
  nbSeats: number
  status: GameStatus
  createdAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

/**
 * postgress has a limit of 32767 (int16) bind parameters for a query. Some sources say 65536 (int32), it's not clear.
 * However, pglite has 32767 for sure as tests break when we bust it.
 * We'll batch insert planets to avoid the limit, as we can easily insert 3000+ planets with 15+ attributes each, leading to 45k+ bind paremeters.
 */
const PLANET_INSERT_BATCH_SIZE = 1_000 // ~15k/32k bind parameters (15 per planet)

export class GamesRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "games-repository" })
  }

  public async getPlayerId(
    { gameId, accountId }: { gameId: GameId; accountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerId | undefined, string>> {
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
      return Result.Failure(couldNot("check if player joined game"))
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
        rulesetId: gamesTable.rulesetId,
      })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(gamesForStart.length <= 1)

    const gameForStart = gamesForStart[0]
    if (gameForStart === undefined) {
      throw new TransactionRollbackError("The game does not exist.")
    }

    const playerIdRows = await tx
      .select({ playerId: playersTable.playerId })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameForStart.id))
    Assert.isTrue(playerIdRows.length > 0)

    const playerIds: readonly PlayerId[] = playerIdRows.map(({ playerId }) => playerId)

    const ruleset = await this.getRuleset({ rulesetId: gameForStart.rulesetId }, tx)
    if (ruleset === undefined) {
      throw new TransactionRollbackError("No ruleset found for this game")
    }

    return branded({
      gameId: gameForStart.id,
      createdByAccountId: gameForStart.createdByAccountId,
      mapGenerationSeed: gameForStart.mapGenerationSeed,
      status: gameForStart.status,
      turnInterval: Time.create(gameForStart.turnIntervalSeconds, UnitOfTime.SECONDS),
      playerIds,
      ruleset,
    })
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async startGame(startGameModel: StartGameModel, tx: Transaction): Promise<void> {
    // Prepare data
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

    const resources: NewResourceRow[] = startGameModel.playerResources.map((playerResource) => ({
      ...playerResource,
      gameId: startGameModel.context.gameId,
    }))
    const availableActions: NewActionRow[] = startGameModel.availableActions.map((availableAction) => ({
      ...availableAction,
      gameId: startGameModel.context.gameId,
      turn: gameTurn.turn,
      selectedTargets: null,
    }))
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

    // Update db
    const updatedGames = await tx
      .update(gamesTable)
      .set({ startedAt: startGameModel.startedAt, status: startGameModel.status })
      .where(and(eq(gamesTable.id, startGameModel.context.gameId)))
      .returning({ id: gamesTable.id })
    Assert.isTrue(updatedGames.length === 1)

    await tx.insert(turnsTable).values(gameTurn)
    await tx.insert(turnsProcessingTable).values(turnProcessing)
    await tx.insert(resourcesTable).values(resources)
    if (availableActions.length > 0) {
      await tx.insert(actionsTable).values(availableActions)
    }
    await tx.insert(starsTable).values(stars)
    for (let index = 0; index < planets.length; index += PLANET_INSERT_BATCH_SIZE) {
      await tx.insert(planetsTable).values(planets.slice(index, index + PLANET_INSERT_BATCH_SIZE))
    }
  }

  /**
   * Gets all game listings; filtering and pagination can be added when needed.
   */
  public async getGameListings(
    { accountId }: { accountId: AccountId | undefined },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameListingModel[], string>> {
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
      return Result.Failure(couldNot("get game listings"))
    }

    return listingsResult
  }

  public async getGameCreationSettings(db: PostgresRepository["db"] = this.db): Promise<Result<GameCreationSettingsModel, string>> {
    const rulesetSummariesResult = await Result.tryCatch(
      db
        .select({
          id: rulesetsTable.id,
          name: rulesetsTable.name,
          isDefault: rulesetsTable.isDefault,
        })
        .from(rulesetsTable),
    )
    if (Result.isFailure(rulesetSummariesResult)) {
      this.logger.error("Could not get ruleset summaries", { error: rulesetSummariesResult.error })
      return Result.Failure(couldNot("get ruleset summaries"))
    }

    return Result.Success({
      rulesets: rulesetSummariesResult.value,
    })
  }

  public async createGame(
    createGameModel: CreateGameModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ createdGameId: GameId }, string>> {
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
      return Result.Failure(couldNot("create game lobby"))
    }

    return createGameResult
  }

  public async getGameById(
    { gameId }: { gameId: GameId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<GameDetailsModel | undefined, string>> {
    const gameRowResult = await Result.tryCatch(
      db
        .select({
          game: gamesTable,
          ruleset: {
            id: rulesetsTable.id,
            name: rulesetsTable.name,
            isDefault: rulesetsTable.isDefault,
          },
        })
        .from(gamesTable)
        .innerJoin(rulesetsTable, eq(rulesetsTable.id, gamesTable.rulesetId))
        .where(eq(gamesTable.id, gameId)),
    )
    if (Result.isFailure(gameRowResult)) {
      this.logger.error("Failed to get game", { gameId, error: gameRowResult.error })
      return Result.Failure(couldNot("get game"))
    }
    Assert.isTrue(gameRowResult.value.length <= 1)

    const gameWithRuleset = gameRowResult.value[0]
    if (gameWithRuleset === undefined) {
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
      this.logger.error("Failed to get players in the game", { gameId, error: playersResult.error })
      return Result.Failure(couldNot("get players in the game"))
    }

    return Result.Success(
      toGameDetailsModel({ gameRow: gameWithRuleset.game, ruleset: gameWithRuleset.ruleset, players: playersResult.value }),
    )
  }

  public async getGameForJoin({ gameId }: { gameId: GameId }, tx: Transaction): Promise<Result<GameForJoin, string>> {
    const games = await tx
      .select({ gameId: gamesTable.id, status: gamesTable.status, nbSeats: gamesTable.nbSeats })
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
      branded({
        ...game,
        players: playerRows,
      }),
    )
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async joinGame({ context, playerId, color, status }: JoinGameModel, tx: Transaction): Promise<void> {
    const gamePlayers = await tx.insert(playersTable).values({ gameId: context.gameId, playerId, color }).returning()
    Assert.isTrue(gamePlayers.length === 1)

    if (status !== context.status) {
      const updatedGames = await tx.update(gamesTable).set({ status }).where(eq(gamesTable.id, context.gameId)).returning()
      Assert.isTrue(updatedGames.length === 1)
    }
  }

  public async getGameForLeave({ gameId }: { gameId: GameId }, tx: Transaction): Promise<Result<GameForLeave, string>> {
    const games = await tx
      .select({ gameId: gamesTable.id, status: gamesTable.status, createdByAccountId: gamesTable.createdByAccountId })
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
      branded({
        ...game,
        playerIds: playerRows.map(({ playerId }) => playerId),
      }),
    )
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
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

  /**
   * Gets the ruleset by id.
   * Does not assume that the ruleset must exist.
   */
  private async getRuleset({ rulesetId }: { rulesetId: RulesetId }, tx: Transaction): Promise<Ruleset | undefined> {
    const rulesetRows = await tx.select().from(rulesetsTable).where(eq(rulesetsTable.id, rulesetId))
    Assert.isTrue(rulesetRows.length <= 1)
    if (rulesetRows[0] === undefined) {
      return undefined
    }

    return RulesetsRepository.toRuleset(rulesetRows[0])
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

function toGameDetailsModel({
  gameRow,
  ruleset,
  players,
}: {
  gameRow: GameRow
  ruleset: RulesetSummaryModel
  players: GamePlayerModel[]
}): GameDetailsModel {
  const creator = players.find((player) => player.id === branded(gameRow.createdByAccountId))
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
      ruleset,
    },
    creator,
    players,
  }
}
