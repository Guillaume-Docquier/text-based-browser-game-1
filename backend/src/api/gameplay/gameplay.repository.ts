import { type Branded, Assert, type Logger, Result, type RngState, Time, UnitOfTime, branded } from "@guillaume-docquier/tools-ts"
import { and, desc, eq } from "drizzle-orm"
import type { PlanetCoordinates } from "#api/shared/PlanetCoordinates.ts"
import type { StarCoordinates } from "#api/shared/StarCoordinates.ts"
import type { Clock } from "#lib/Clock.ts"
import type { AccountId } from "#lib/db/accounts/AccountId.ts"
import type { ActionId } from "#lib/db/actions/ActionId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GameId } from "#lib/db/games/GameId.ts"
import type { GameStatus } from "#lib/db/games/GameStatus.ts"
import type { PlanetBiome } from "#lib/db/planets/PlanetBiome.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlanetSize } from "#lib/db/planets/PlanetSize.ts"
import type { PlayerColor } from "#lib/db/players/PlayerColor.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import type { RulesetId } from "#lib/db/rulesets/RulesetId.ts"
import {
  actionsTable,
  gamesTable,
  planetsTable,
  playersTable,
  resourcesTable,
  starsTable,
  turnsTable,
  turnsProcessingTable,
  rulesetsTable,
} from "#lib/db/schema.ts"
import type { StarId } from "#lib/db/stars/StarId.ts"
import { TurnStatus } from "#lib/db/turns/TurnStatus.ts"
import { couldNot, TransactionRollbackError } from "#lib/errors.ts"
import type { Action, AvailableAction, SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { ResolvedTargets } from "#lib/rules-engine/ruleset-model/actions/ResolvedTargets.ts"
import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

type NewActionRow = typeof actionsTable.$inferInsert
type NewResourceRow = typeof resourcesTable.$inferInsert
type ResourceRow = typeof resourcesTable.$inferSelect
type NewTurnRow = typeof turnsTable.$inferInsert
type NewTurnProcessingRow = typeof turnsProcessingTable.$inferInsert

/**
 * postgress has a limit of 32767 (int16) bind parameters for a query. Some sources say 65536 (int32), it's not clear.
 * However, pglite has 32767 for sure as tests break when we bust it.
 * We'll batch insert planets to avoid the limit, as we can easily insert 3000+ planets with 15+ attributes each, leading to 45k+ bind paremeters.
 */
const PLANET_INSERT_BATCH_SIZE = 1_000

export type ActionSubmissionsForUpdate = Branded<
  {
    readonly gameId: GameId
    readonly playerId: PlayerId
    readonly turn: number
    readonly resources: Resources
    readonly actions: Action[]
    readonly ruleset: Ruleset
  },
  "ActionsForSubmission"
>

export type UpdateActionSubmissionsModel = {
  /**
   * The ActionsForSubmission must be acquired in the same transaction.
   */
  readonly context: ActionSubmissionsForUpdate
  /**
   * The actions to update, can be newly selected, target updates or de-selected.
   */
  readonly actions: Array<Pick<Action, "id" | "targets">>
}

type PlayerViewPlayerModel = {
  id: PlayerId
  color: PlayerColor
}

type PlayerViewActionModel = {
  readonly id: ActionId
  readonly actionDefinitionId: SubmittedAction["actionDefinitionId"]
  readonly targets: ResolvedTargets | null
}

export type PlayerViewModel = {
  readonly gameId: GameId
  readonly player: PlayerViewPlayerModel
  readonly opponents: Record<PlayerId, PlayerViewPlayerModel>
  readonly galaxy: GalaxyModel
  readonly turn: number
  readonly turnStatus: TurnStatus
  readonly turnEndsAt: Date
  readonly resources: Resources
  /**
   * All the available actions, with their targets if submitted.
   */
  readonly actions: readonly PlayerViewActionModel[]
  readonly ruleset: Ruleset
}

/**
 * Owning a GameForStart within a transaction guarantees that the game is locked and exists at this time.
 * It does not mean it can be started, you have to check the state and decide.
 */
export type GameForStart = Branded<
  {
    readonly gameId: GameId
    readonly createdByAccountId: AccountId
    readonly mapGenerationSeed: number
    readonly status: GameStatus
    readonly turnInterval: Time
    readonly playerIds: readonly PlayerId[]
    readonly ruleset: Ruleset
  },
  "GameForStart"
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
  readonly galaxy: GalaxyModel
}

type StarModel = {
  readonly id: StarId
  readonly name: string
  readonly coordinates: StarCoordinates
  readonly x: number
  readonly y: number
}

type PlanetModel = {
  readonly id: PlanetId
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
      turn: 0,
      status: TurnStatus.COLLECTING_ACTIONS,
      startedAt: startGameModel.startedAt,
      endsAt: startGameModel.turnEndsAt,
      rngGeneratorState: startGameModel.rngState.generatorState,
      rngSpareNormal: startGameModel.rngState.spareNormal,
    }

    const turnProcessing: NewTurnProcessingRow = {
      gameId: startGameModel.context.gameId,
      turn: gameTurn.turn,
      scheduledFor: startGameModel.turnEndsAt,
    }

    const resources: NewResourceRow[] = startGameModel.playerResources.map((playerResource) => ({
      ...playerResource,
      gameId: startGameModel.context.gameId,
    }))
    const availableActions: NewActionRow[] = startGameModel.availableActions.map((availableAction) => ({
      ...availableAction,
      gameId: startGameModel.context.gameId,
      turn: gameTurn.turn,
      targets: null,
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

  public async getPlayerView(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerViewModel | undefined, string>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const turns = await tx
          .select({
            turn: turnsTable.turn,
            status: turnsTable.status,
            endsAt: turnsTable.endsAt,
          })
          .from(turnsTable)
          .where(eq(turnsTable.gameId, gameId))
          .orderBy(desc(turnsTable.startedAt))
          .limit(1)
        Assert.isTrue(turns.length <= 1)

        const turn = turns[0]
        if (turn === undefined) {
          return undefined
        }

        const gameRows = await tx.select({ rulesetId: gamesTable.rulesetId }).from(gamesTable).where(eq(gamesTable.id, gameId))
        Assert.isTrue(gameRows.length === 1)
        Assert.isDefined(gameRows[0])

        const ruleset = await this.getRuleset({ rulesetId: gameRows[0].rulesetId }, tx)
        if (ruleset === undefined) {
          throw new TransactionRollbackError("No ruleset found for this game")
        }

        const players = await tx
          .select({
            id: playersTable.playerId,
            color: playersTable.color,
          })
          .from(playersTable)
          .where(eq(playersTable.gameId, gameId))
        const player = players.find(({ id }) => id === playerId)
        Assert.isDefined(player)
        const opponents = Object.fromEntries(players.filter(({ id }) => id !== playerId).map((opponent) => [opponent.id, opponent]))

        const playerResources = await tx
          .select()
          .from(resourcesTable)
          .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))

        const availableActionRows =
          turn.status === TurnStatus.COLLECTING_ACTIONS
            ? await tx
                .select({
                  id: actionsTable.id,
                  actionDefinitionId: actionsTable.actionDefinitionId,
                  targets: actionsTable.targets,
                })
                .from(actionsTable)
                .where(and(eq(actionsTable.gameId, gameId), eq(actionsTable.playerId, playerId), eq(actionsTable.turn, turn.turn)))
                .orderBy(actionsTable.id)
            : []

        const stars = await tx.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(starsTable.id)
        const planets = await tx.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(planetsTable.id)

        return {
          player,
          opponents,
          galaxy: toGalaxyModel({ stars, planets }),
          gameId,
          turn: turn.turn,
          turnStatus: turn.status,
          turnEndsAt: turn.endsAt,
          resources: toResourceBag(playerResources),
          actions: availableActionRows,
          ruleset,
        }
      }),
    )

    if (Result.isFailure(playerViewResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerViewResult.error })
      return Result.Failure(couldNot("get player game state by ids"))
    }

    return playerViewResult
  }

  public async getActionSubmissionsForUpdate(
    { gameId, playerId, turn }: { gameId: GameId; playerId: PlayerId; turn: number },
    tx: Transaction,
  ): Promise<ActionSubmissionsForUpdate> {
    const turns = await tx
      .select({ gameId: turnsTable.gameId, turn: turnsTable.turn, endsAt: turnsTable.endsAt })
      .from(turnsTable)
      .where(and(eq(turnsTable.gameId, gameId), eq(turnsTable.turn, turn), eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS)))
      .for("no key update")
    if (turns.length !== 1) {
      throw new TransactionRollbackError("Cannot submit actions in the current turn status")
    }
    Assert.isDefined(turns[0])
    if (turns[0].endsAt <= this.clock.now()) {
      throw new TransactionRollbackError("Cannot submit actions after the current turn deadline")
    }

    const games = await tx
      .select({
        rulesetId: gamesTable.rulesetId,
      })
      .from(gamesTable)
      .where(eq(gamesTable.id, gameId))
    Assert.isTrue(games.length === 1)
    Assert.isDefined(games[0])

    const ruleset = await this.getRuleset({ rulesetId: games[0].rulesetId }, tx)
    if (ruleset === undefined) {
      throw new TransactionRollbackError("No ruleset found for this game")
    }

    const resourceRows = await tx
      .select()
      .from(resourcesTable)
      .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))

    const actions = await tx
      .select()
      .from(actionsTable)
      .where(and(eq(actionsTable.gameId, gameId), eq(actionsTable.playerId, playerId), eq(actionsTable.turn, turn)))

    return branded({
      gameId,
      playerId,
      turn,
      resources: toResourceBag(resourceRows),
      actions,
      ruleset,
    })
  }

  // oxlint-disable-next-line no-unused-vars -- context is required here as a proof that these actions can be updated, because to get the context you had to check. It's not a super strong enforcement, but the spirit is there.
  public async updateActionSubmissions({ context, actions }: UpdateActionSubmissionsModel, tx: Transaction): Promise<void> {
    const updatedAt = this.clock.now()

    // Not super great, drizzle doesn't support batch updates very well, could use sql statements probably
    await Promise.all(
      actions.map(
        async (action) => await tx.update(actionsTable).set({ targets: action.targets, updatedAt }).where(eq(actionsTable.id, action.id)),
      ),
    )
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

function toResourceBag(resourceRows: readonly ResourceRow[]): Resources {
  const entries = Object.values(ResourceType).map((resourceType) => {
    const resource = resourceRows.find((row) => row.resourceType === resourceType)
    return [resourceType, resource?.amount ?? 0] as const
  })

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript cannot infer Object.fromEntries completeness.
  return Object.fromEntries(entries) as Resources
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
