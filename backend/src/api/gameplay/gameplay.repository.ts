import { type Branded, Assert, type Logger, Result, Time, UnitOfTime, branded } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import type { StarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { ActionType } from "#lib/db/gameplay/actionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import type { PlanetBiome } from "#lib/db/gameplay/PlanetBiome.ts"
import type { PlanetSize } from "#lib/db/gameplay/PlanetSize.ts"
import { GameStatus } from "#lib/db/lobbies/GameStatus.ts"
import type { PlayerColor } from "#lib/db/PlayerColor.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  actionsTable,
  gameStatesTable,
  gamesTable,
  planetsTable,
  playersTable,
  resourcesTable,
  starsTable,
  turnsTable,
} from "#lib/db/schema.ts"
import { couldNot, TransactionRollback } from "#lib/errors.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type ActionRow = typeof actionsTable.$inferSelect
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTurnRow = typeof turnsTable.$inferInsert

/**
 * postgress has a limit of 32767 (int16) bind parameters for a query. Some sources say 65536 (int32), it's not clear.
 * However, pglite has 32767 for sure as tests break when we bust it.
 * We'll batch insert planets to avoid the limit, as we can easily insert 3000+ planets with 15+ attributes each, leading to 45k+ bind paremeters.
 */
const PLANET_INSERT_BATCH_SIZE = 500

export type ActionModel = ActionRow

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
export type ActionContextModel = {
  turn: number
  money: number
}

type PlayerViewPlayerModel = {
  id: PlayerId
  color: PlayerColor
}

export type PlayerViewModel = {
  gameId: number
  player: PlayerViewPlayerModel
  opponents: Record<PlayerId, PlayerViewPlayerModel>
  galaxy: GalaxyModel
  turn: number
  nextTurnAt: Date
  resources: {
    money: number
  }
}

/**
 * Owning a GameForStart within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be started, you have to check the state and decide.
 */
export type GameForStart = Branded<
  {
    readonly id: GameId
    readonly createdByAccountId: AccountId
    readonly seed: number
    readonly status: GameStatus
    readonly turnInterval: Time
    readonly playerIds: readonly PlayerId[]
  },
  "GameForStart"
>

export type StartGameModel = {
  /**
   * The GameForStart must be acquired in the same transaction
   */
  readonly game: GameForStart
  readonly status: GameStatus
  readonly startedAt: Date
  readonly nextTurnAt: Date
  readonly playerResources: ReadonlyArray<{
    readonly playerId: PlayerId
    readonly resourceType: ResourceType
    readonly amount: number
  }>
  readonly galaxy: GalaxyModel
}

type StarModel = {
  readonly id: number
  readonly name: string
  readonly coordinates: StarCoordinates
  readonly x: number
  readonly y: number
}

type PlanetModel = {
  readonly id: number
  readonly name: string
  readonly coordinates: PlanetCoordinates
  readonly x: number
  readonly y: number
  readonly biome: PlanetBiome
  readonly size: PlanetSize
  readonly fertility: number
  readonly metal: number
  readonly fuel: number
  readonly energy: number
  readonly maxPopulation: number
  readonly area: number
}

export type GalaxyModel = {
  readonly systems: ReadonlyArray<{
    readonly star: StarModel
    readonly planets: readonly PlanetModel[]
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

  public async getGameForStart({ gameId }: { gameId: GameId }, tx: Transaction): Promise<Result<GameForStart, string>> {
    const gamesForStart = await tx
      .select({
        id: gamesTable.id,
        createdByAccountId: gamesTable.createdByAccountId,
        seed: gamesTable.seed,
        status: gamesTable.status,
        turnIntervalSeconds: gamesTable.turnIntervalSeconds,
      })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
      .for("no key update")
    Assert.isTrue(gamesForStart.length <= 1)

    const gameForStart = gamesForStart[0]
    if (gameForStart === undefined) {
      return Result.Failure("The game does not exist.")
    }

    const playerIdRows = await tx
      .select({ playerId: playersTable.playerId })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameForStart.id))
    Assert.isTrue(playerIdRows.length > 0)

    const playerIds: readonly PlayerId[] = playerIdRows.map(({ playerId }) => playerId)

    return Result.Success(
      branded<GameForStart>({
        id: gameForStart.id,
        createdByAccountId: gameForStart.createdByAccountId,
        seed: gameForStart.seed,
        status: gameForStart.status,
        turnInterval: Time.create(gameForStart.turnIntervalSeconds, UnitOfTime.SECONDS),
        playerIds,
      }),
    )
  }

  /**
   * The only failure mode for this method is throwing to rollback the transaction.
   */
  public async startGame(startGameModel: StartGameModel, tx: Transaction): Promise<void> {
    const gameState = {
      gameId: startGameModel.game.id,
      turn: 0,
      nextTurnAt: startGameModel.nextTurnAt,
    } as const satisfies NewGameStateRow

    const gameTurn: NewTurnRow = {
      gameId: startGameModel.game.id,
      turn: gameState.turn,
      scheduledFor: startGameModel.nextTurnAt,
    }

    const resources: NewResourceRow[] = startGameModel.playerResources.map((playerResource) => ({
      ...playerResource,
      gameId: startGameModel.game.id,
    }))
    const stars = startGameModel.galaxy.systems.map(({ star }) => ({
      gameId: startGameModel.game.id,
      ...star,
    }))
    const planets = startGameModel.galaxy.systems.flatMap(({ star, planets: systemPlanets }) =>
      systemPlanets.map((planet) => ({
        gameId: startGameModel.game.id,
        starId: star.id,
        ...planet,
      })),
    )

    const updatedGames = await tx
      .update(gamesTable)
      .set({ startedAt: startGameModel.startedAt, status: startGameModel.status })
      .where(and(eq(gamesTable.id, startGameModel.game.id)))
      .returning({ id: gamesTable.id })
    Assert.isTrue(updatedGames.length === 1)

    await tx.insert(resourcesTable).values(resources)
    await tx.insert(starsTable).values(stars)
    for (let index = 0; index < planets.length; index += PLANET_INSERT_BATCH_SIZE) {
      await tx.insert(planetsTable).values(planets.slice(index, index + PLANET_INSERT_BATCH_SIZE))
    }
    await tx.insert(gameStatesTable).values(gameState)
    await tx.insert(turnsTable).values(gameTurn)
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

        const players = await tx
          .select({ id: playersTable.playerId, color: playersTable.color })
          .from(playersTable)
          .where(eq(playersTable.gameId, gameId))
        const player = players.find(({ id }) => id === playerId)
        Assert.isDefined(player)
        const opponents = Object.fromEntries(players.filter(({ id }) => id !== playerId).map((opponent) => [opponent.id, opponent]))

        const playerResources = await tx
          .select()
          .from(resourcesTable)
          .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money, "money")

        const stars = await tx.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(starsTable.id)
        const planets = await tx.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(planetsTable.id)

        return {
          ...gameState,
          player,
          opponents,
          galaxy: toGalaxyModel({ stars, planets }),
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

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async getCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; turn: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<ActionModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(actionsTable)
        .where(and(eq(actionsTable.gameId, params.gameId), eq(actionsTable.playerId, params.playerId), eq(actionsTable.turn, params.turn))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async getActionContext(
    params: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<ActionContextModel, string>> {
    const contextResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingActions({ gameId: params.gameId }, tx)

        const joinedPlayers = await tx
          .select({ playerId: playersTable.playerId })
          .from(playersTable)
          .where(and(eq(playersTable.gameId, params.gameId), eq(playersTable.playerId, params.playerId)))
        if (joinedPlayers.length !== 1) {
          throw new TransactionRollback("Player is not in this game.")
        }

        const gameStates = await tx
          .select({ turn: gameStatesTable.turn })
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
          turn: gameStates[0].turn,
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

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async setCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; turn: number; actionType: ActionType },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<ActionModel, string>> {
    const upsertResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingActions({ gameId: params.gameId }, tx)

        const updatedAt = this.clock.now()
        const actions = await tx
          .insert(actionsTable)
          .values({ ...params, updatedAt })
          .onConflictDoUpdate({
            target: [actionsTable.gameId, actionsTable.playerId, actionsTable.turn],
            set: {
              actionType: params.actionType,
              updatedAt,
            },
          })
          .returning()

        Assert.isTrue(actions.length === 1)
        Assert.isDefined(actions[0])

        return actions[0]
      }),
    )

    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not upsert action", { ...params, error: upsertResult.error })
      return Result.Failure(couldNot("upsert action"))
    }

    return upsertResult
  }

  /**
   * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
   */
  public async clearCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; turn: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await lockGameCollectingActions({ gameId: params.gameId }, tx)

        await tx
          .delete(actionsTable)
          .where(
            and(eq(actionsTable.gameId, params.gameId), eq(actionsTable.playerId, params.playerId), eq(actionsTable.turn, params.turn)),
          )
      }),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete action"))
    }

    return Result.Success(true)
  }
}

function toGalaxyModel({
  stars,
  planets,
}: {
  stars: ReadonlyArray<typeof starsTable.$inferSelect>
  planets: ReadonlyArray<typeof planetsTable.$inferSelect>
}): GalaxyModel {
  const planetsByStarId = Map.groupBy(planets, (planet) => planet.starId)
  const systems = stars.map((star) => ({
    star,
    planets: planetsByStarId.get(star.id) ?? [],
  }))

  return { systems }
}

/**
 * @deprecated Temporary POC implementation, it's bad and I don't care because we'll throw it all away
 */
async function lockGameCollectingActions({ gameId }: { gameId: GameId }, db: PostgresRepository["db"]): Promise<void> {
  const games = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(and(eq(gamesTable.id, gameId), eq(gamesTable.status, GameStatus.COLLECTING_ACTIONS)))
    .for("no key update")

  if (games.length !== 1) {
    throw new TransactionRollback("Cannot submit actions in the current game status")
  }
}
