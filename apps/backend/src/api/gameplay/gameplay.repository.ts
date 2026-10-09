import { type Branded, Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, desc, eq, gt, inArray } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import type { Resources } from "shared/domain/resources/Resources.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import type { RulesetId } from "shared/domain/ruleset/RulesetId.ts"
import type { Action } from "shared/domain/turns/actions/Action.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import type { SelectedTargets } from "shared/domain/turns/actions/SelectedTargets.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { Galaxy } from "shared/domain/world/Galaxy.ts"
import type { Planet } from "shared/domain/world/planets/Planet.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import type { Star } from "shared/domain/world/stars/Star.ts"
import type { ResolutionFleet } from "shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "shared/turn-resolution/state/ResolutionPlanet.ts"
import type { Clock } from "#lib/Clock.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { TransactionRollbackError } from "#lib/db/drizzle/TransactionRollbackError.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  actionsTable,
  fleetsTable,
  gamesTable,
  planetsTable,
  playersTable,
  resourcesTable,
  starsTable,
  turnsTable,
  turnsProcessingTable,
  rulesetsTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import { RulesetsRepository } from "#lib/rulesets/rulesets.repository.ts"

type ResourceRow = typeof resourcesTable.$inferSelect

export type ActionSubmissionsForUpdate = Branded<
  "ActionsForSubmission",
  Readonly<{
    gameId: GameId
    playerId: PlayerId
    turn: number
    resources: Readonly<Resources>
    actions: readonly Action[]
    ruleset: Ruleset
  }>
>

export type UpdateActionSubmissionsModel = Readonly<{
  /**
   * The ActionsForSubmission must be acquired in the same transaction.
   */
  context: ActionSubmissionsForUpdate
  /**
   * The actions to update, can be newly selected, selected target updates or de-selected.
   */
  actions: ReadonlyArray<Pick<Action, "id" | "selectedTargets">>
}>

type PlayerViewPlayerModel = Readonly<{
  id: PlayerId
  color: PlayerColor
  isReady: boolean
}>

export type ReadinessForUpdate = Branded<
  "ReadinessForUpdate",
  Readonly<{
    gameId: GameId
    playerId: PlayerId
    turn: number
    players: readonly PlayerViewPlayerModel[]
  }>
>

type PlayerViewActionModel = Readonly<{
  id: ActionId
  actionDefinitionId: ActionDefinitionId
  selectedTargets: SelectedTargets | null
}>

export type PlayerViewModel = Readonly<{
  gameId: GameId
  player: PlayerViewPlayerModel
  opponents: Readonly<Record<PlayerId, PlayerViewPlayerModel>>
  galaxy: Galaxy
  fleets: readonly ResolutionFleet[]
  turn: number
  turnStatus: TurnStatus
  turnEndsAt: Date
  resources: Resources
  /**
   * All the available actions, with their selected targets if submitted.
   */
  actions: readonly PlayerViewActionModel[]
  ruleset: Ruleset
}>

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger
  private readonly clock: Clock

  public constructor({ logger, db, clock }: { logger: Logger; db: PostgresRepository["db"]; clock: Clock }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
    this.clock = clock
  }

  public async getPlayerView(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerViewModel | undefined, string>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(
        async (tx) => {
          const turns = await tx
            .select({
              turn: turnsTable.turn,
              status: turnsTable.status,
              endsAt: turnsTable.endsAt,
            })
            .from(turnsTable)
            .where(eq(turnsTable.gameId, gameId))
            .orderBy(desc(turnsTable.turn))
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
              isReady: playersTable.isReady,
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

          const availableActionRows = await tx
            .select({
              id: actionsTable.id,
              actionDefinitionId: actionsTable.actionDefinitionId,
              selectedTargets: actionsTable.selectedTargets,
            })
            .from(actionsTable)
            .where(and(eq(actionsTable.gameId, gameId), eq(actionsTable.playerId, playerId), eq(actionsTable.turn, turn.turn)))
            .orderBy(actionsTable.id)

          const stars = await tx.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(starsTable.id)
          const planets = await tx.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(planetsTable.id)
          const fleetRows = await tx.select().from(fleetsTable).where(eq(fleetsTable.gameId, gameId)).orderBy(fleetsTable.id)

          return {
            player,
            opponents,
            galaxy: toGalaxyModel({ stars, planets }),
            fleets: fleetRows.map(toFleet),
            gameId,
            turn: turn.turn,
            turnStatus: turn.status,
            turnEndsAt: turn.endsAt,
            resources: toResourceBag(playerResources),
            actions: availableActionRows,
            ruleset,
          }
        },
        { isolationLevel: "repeatable read" },
      ),
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
    const gameTurns = await tx
      .select({ gameId: turnsTable.gameId, turn: turnsTable.turn, endsAt: turnsTable.endsAt })
      .from(turnsTable)
      .where(
        and(
          eq(turnsTable.gameId, gameId),
          eq(turnsTable.turn, turn),
          eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS),
          gt(turnsTable.endsAt, this.clock.now()),
        ),
      )
      .for("no key update")
    Assert.isTrue(gameTurns.length <= 1)

    const gameTurn = gameTurns[0]
    if (gameTurn === undefined) {
      throw new TransactionRollbackError("Cannot submit actions for this turn")
    }

    const players = await tx
      .select({ isReady: playersTable.isReady })
      .from(playersTable)
      .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, playerId)))
    Assert.isTrue(players.length === 1)
    Assert.isDefined(players[0])
    if (players[0].isReady) {
      throw new TransactionRollbackError("Cannot submit actions while ready")
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

  public async getPlanetsByIds(
    { gameId, planetIds }: { gameId: GameId; planetIds: readonly PlanetId[] },
    db: PostgresRepository["db"] = this.db,
  ): Promise<ResolutionPlanet[]> {
    if (planetIds.length === 0) {
      return []
    }

    return await db
      .select({
        id: planetsTable.id,
        name: planetsTable.name,
        ownerPlayerId: planetsTable.ownerPlayerId,
        x: planetsTable.x,
        y: planetsTable.y,
      })
      .from(planetsTable)
      .where(and(eq(planetsTable.gameId, gameId), inArray(planetsTable.id, planetIds)))
  }

  public async getFleetsByIds(
    { gameId, fleetIds }: { gameId: GameId; fleetIds: readonly FleetId[] },
    db: PostgresRepository["db"] = this.db,
  ): Promise<ResolutionFleet[]> {
    if (fleetIds.length === 0) {
      return []
    }

    const fleetRows = await db
      .select()
      .from(fleetsTable)
      .where(and(eq(fleetsTable.gameId, gameId), inArray(fleetsTable.id, fleetIds)))
    return fleetRows.map(toFleet)
  }

  public async getReadinessForUpdate(
    { gameId, turn, playerId }: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<ReadinessForUpdate> {
    const gameTurns = await tx
      .select({
        gameId: turnsTable.gameId,
        turn: turnsTable.turn,
        endsAt: turnsTable.endsAt,
      })
      .from(turnsTable)
      .where(
        and(
          eq(turnsTable.gameId, gameId),
          eq(turnsTable.turn, turn),
          eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS),
          gt(turnsTable.endsAt, this.clock.now()),
        ),
      )
      .for("no key update")
    Assert.isTrue(gameTurns.length <= 1)

    const gameTurn = gameTurns[0]
    if (gameTurn === undefined) {
      throw new TransactionRollbackError("Cannot submit actions for this game and turn", {})
    }

    const players = await tx
      .select({ id: playersTable.playerId, color: playersTable.color, isReady: playersTable.isReady })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId))
    Assert.isTrue(players.some((player) => player.id === playerId))

    return branded({ gameId, turn, playerId, players })
  }

  public async updateReadiness({ context, isReady }: { context: ReadinessForUpdate; isReady: boolean }, tx: Transaction): Promise<void> {
    await tx
      .update(playersTable)
      .set({ isReady })
      .where(and(eq(playersTable.gameId, context.gameId), eq(playersTable.playerId, context.playerId)))
  }

  public async closeTurn({ context, closedAt }: { context: ReadinessForUpdate; closedAt: Date }, tx: Transaction): Promise<void> {
    // we close the turn before updating processing to avoid races where the turn processing would pick up a turn that's not yet marked as AWAITING_PROCESSING
    await tx
      .update(turnsTable)
      .set({ closedAt, status: TurnStatus.AWAITING_PROCESSING })
      .where(and(eq(turnsTable.gameId, context.gameId), eq(turnsTable.turn, context.turn)))

    await tx
      .update(turnsProcessingTable)
      .set({ scheduledFor: closedAt })
      .where(and(eq(turnsProcessingTable.gameId, context.gameId), eq(turnsProcessingTable.turn, context.turn)))
  }

  public async updateActionSubmissions({ context, actions }: UpdateActionSubmissionsModel, tx: Transaction): Promise<void> {
    const updatedAt = this.clock.now()

    // Not super great, drizzle doesn't support batch updates very well, could use sql statements probably
    await Promise.all(
      actions.map(
        async (action) =>
          await tx
            .update(actionsTable)
            .set({ selectedTargets: action.selectedTargets, updatedAt })
            .where(
              and(
                eq(actionsTable.gameId, context.gameId),
                eq(actionsTable.playerId, context.playerId),
                eq(actionsTable.turn, context.turn),
                eq(actionsTable.id, action.id),
              ),
            ),
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
}): Galaxy {
  const planetsByStarId = Map.groupBy(planets, (planet) => planet.starId)
  const systems = stars.map((star) => ({
    star: toStarModel(star),
    planets: (planetsByStarId.get(star.id) ?? []).map(toPlanetModel),
  }))

  return { systems }
}

function toStarModel({ id, name, coordinates, x, y }: typeof starsTable.$inferSelect): Star {
  return { id, name, coordinates, x, y }
}

function toPlanetModel({
  id,
  ownerPlayerId,
  name,
  coordinates,
  x,
  y,
  biome,
  size,
  fertility,
  metal,
  fuel,
  energy,
  maxPopulation,
  area,
}: typeof planetsTable.$inferSelect): Planet {
  return {
    id,
    ownerPlayerId,
    name,
    coordinates,
    x,
    y,
    biome,
    size,
    fertility,
    metal,
    fuel,
    energy,
    maxPopulation,
    area,
  }
}

function toFleet({ destinationPlanetId, distanceToEnd, ...fleet }: typeof fleetsTable.$inferSelect): ResolutionFleet {
  return {
    ...fleet,
    ...(destinationPlanetId === null ? {} : { destinationPlanetId }),
    ...(distanceToEnd === null ? {} : { distanceToEnd }),
  }
}
