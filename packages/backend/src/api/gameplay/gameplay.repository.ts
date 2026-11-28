import { type Branded, Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, desc, eq, sql } from "drizzle-orm"
import { availableCredits } from "shared/domain/games/credits.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { Building } from "shared/domain/world/buildings/Building.ts"
import type { ConstructionOrder } from "shared/domain/world/buildings/ConstructionOrder.ts"
import type { Planet } from "shared/domain/world/planets/Planet.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { SHIP_TEMPLATES, type ShipId } from "shared/domain/world/ships/Ship.ts"
import type { BodyRef, TravelBody, TravelRoute } from "shared/domain/world/ships/travel.ts"
import type { Star } from "shared/domain/world/stars/Star.ts"
import type { StarId } from "shared/domain/world/stars/StarId.ts"
import { canSeeShip, inCurrentVision, scanSources } from "shared/domain/world/vision.ts"
import { GetPlayerViewError, GetPlayerViewRollbackError } from "#api/gameplay/getPlayerView.error.ts"
import type { PlayerView } from "#api/gameplay/PlayerView.ts"
import { UpdateReadinessError, UpdateReadinessRollbackError } from "#api/gameplay/updateReadiness.error.ts"
import type { Clock } from "#lib/Clock.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { planetFacts, PlanetObservationsRepository } from "#lib/db/planetObservations.repository.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  buildingsTable,
  constructionOrdersTable,
  planetObservationsTable,
  planetsTable,
  playersTable,
  moveOrdersTable,
  shipsTable,
  starsTable,
  turnsTable,
  turnsProcessingTable,
} from "#lib/db/schema.ts"
import { GetTurnStateError } from "./getTurnState.error.ts"
import type { TurnState } from "./TurnState.ts"

export type OpenPlanningTurn = Branded<"OpenPlanningTurn", Readonly<{ gameId: GameId; turn: number }>>

export type ReadinessForUpdate = Branded<
  "ReadinessForUpdate",
  Readonly<{
    gameId: GameId
    playerId: PlayerId
    turn: number
    players: ReadonlyArray<{ id: PlayerId; isReady: boolean }>
  }>
>

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
  ): Promise<Result<PlayerView, GetPlayerViewError>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(
        async (tx) => {
          const turns = await tx
            .select({
              turn: turnsTable.turn,
            })
            .from(turnsTable)
            .where(eq(turnsTable.gameId, gameId))
            .orderBy(desc(turnsTable.turn))
            .limit(1)
          Assert.isTrue(turns.length <= 1)

          const turn = turns[0]
          if (turn === undefined) {
            throw new GetPlayerViewRollbackError(GetPlayerViewError.TURN_NOT_FOUND)
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

          const [balance] = await tx
            .select({ credits: playersTable.creditBalance, exact: sql<string>`${playersTable.creditBalance}::text` })
            .from(playersTable)
            .where(and(eq(playersTable.gameId, gameId), eq(playersTable.playerId, playerId)))
          Assert.isDefined(balance)
          Assert.isTrue(balance.credits !== null)

          const { stars, planets, ships, buildingsByPlanet } = await new PlanetObservationsRepository(tx).readWorld(gameId)
          const sources = scanSources(playerId, planets, ships)
          const memory = await tx
            .select()
            .from(planetObservationsTable)
            .where(and(eq(planetObservationsTable.gameId, gameId), eq(planetObservationsTable.playerId, playerId)))
          const remembered = new Map(memory.map((row) => [row.planetId, row]))
          const buildings: Building[] = []
          const visiblePlanets = planets.map((planet): PlayerView["galaxy"]["systems"][number]["planets"][number] & { starId: StarId } => {
            const { id, starId, x, y, name, coordinates } = planet
            const identity = { id, starId, x, y, name, coordinates }
            if (inCurrentVision(planet, sources)) {
              buildings.push(...(buildingsByPlanet.get(id) ?? []))
              return { ...identity, ...planetFacts(planet), observation: "current", observedTurn: turn.turn }
            }
            const prior = remembered.get(id)
            if (prior !== undefined) {
              buildings.push(...prior.buildings)
              return { ...identity, ...prior.facts, observation: "remembered", observedTurn: prior.observedTurn }
            }
            return {
              ...identity,
              observation: "unknown",
              observedTurn: null,
              ownerPlayerId: null,
              biome: null,
              size: null,
              area: null,
              metalProduction: null,
              remainingMetalDeposit: null,
            }
          })
          const constructionOrders = await this.getConstructionOrders({ gameId, turn: turn.turn, playerId }, tx)
          const moves = await this.getMoveOrders({ gameId, turn: turn.turn, playerId }, tx)
          const byShip = new Map(moves.map((move) => [move.shipId, { id: move.id, route: move.route }]))
          return {
            availableCredits: availableCredits(balance.exact, [...constructionOrders, ...moves.map((move) => move.route)]),
            ships: ships
              .filter((ship) => canSeeShip(ship, sources))
              .map((ship): PlayerView["ships"][number] => ({
                ...ship,
                ...SHIP_TEMPLATES[ship.type],
                trip: ship.ownerPlayerId === playerId ? ship.trip : null,
                position: ship.trip === null ? null : ship.position,
                cargo: [],
                order: byShip.get(ship.id) ?? null,
              })),
            constructionOrders,
            buildings,
            player: { ...player, creditBalance: balance.credits, creditBalanceExact: balance.exact },
            opponents,
            galaxy: toGalaxyModel({ stars, planets: visiblePlanets }),
            gameId,
            turn: turn.turn,
          }
        },
        { isolationLevel: "repeatable read" },
      ),
    )

    if (Result.isFailure(playerViewResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerViewResult.error })
      if (playerViewResult.error instanceof GetPlayerViewRollbackError) {
        return Result.Failure(playerViewResult.error.code)
      }

      return Result.Failure(GetPlayerViewError.UNKNOWN)
    }

    return playerViewResult
  }

  public async getTurnState({ gameId }: { gameId: GameId }): Promise<Result<TurnState, GetTurnStateError>> {
    const latestTurn = this.db
      .select({ gameId: turnsTable.gameId, turn: turnsTable.turn, turnStatus: turnsTable.status, turnEndsAt: turnsTable.endsAt })
      .from(turnsTable)
      .where(eq(turnsTable.gameId, gameId))
      .orderBy(desc(turnsTable.turn))
      .limit(1)
      .as("latest_turn")
    const rows = await Result.tryCatch(
      this.db
        .select({
          turn: latestTurn.turn,
          turnStatus: latestTurn.turnStatus,
          turnEndsAt: latestTurn.turnEndsAt,
          playerId: playersTable.playerId,
          isReady: playersTable.isReady,
        })
        .from(latestTurn)
        .innerJoin(playersTable, eq(playersTable.gameId, latestTurn.gameId)),
    )
    if (Result.isFailure(rows)) {
      this.logger.error("Could not get turn state", { gameId, error: rows.error })
      return Result.Failure(GetTurnStateError.UNKNOWN)
    }

    const current = rows.value[0]
    if (current === undefined) {
      return Result.Failure(GetTurnStateError.TURN_NOT_FOUND)
    }

    return Result.Success({
      turn: current.turn,
      turnStatus: current.turnStatus,
      turnEndsAt: current.turnEndsAt,
      readinessByPlayerId: Object.fromEntries(rows.value.map(({ playerId, isReady }) => [playerId, isReady])),
    })
  }

  public async getReadinessForUpdate(
    { gameId, turn, playerId }: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<ReadinessForUpdate> {
    if ((await this.lockOpenTurn({ gameId, turn }, tx)) === undefined) {
      throw new UpdateReadinessRollbackError(UpdateReadinessError.TURN_NOT_OPEN)
    }

    const players = await tx
      .select({ id: playersTable.playerId, isReady: playersTable.isReady })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId))
    Assert.isTrue(players.some((player) => player.id === playerId))

    return branded({ gameId, turn, playerId, players })
  }

  public async lockOpenTurn({ gameId, turn }: { gameId: GameId; turn: number }, tx: Transaction): Promise<OpenPlanningTurn | undefined> {
    const [locked] = await tx
      .select({ endsAt: turnsTable.endsAt })
      .from(turnsTable)
      .where(and(eq(turnsTable.gameId, gameId), eq(turnsTable.turn, turn), eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS)))
      .for("no key update")
    return locked !== undefined && this.clock.now() < locked.endsAt ? branded({ gameId, turn }) : undefined
  }

  private async getConstructionOrders(
    { gameId, turn, playerId }: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<ConstructionOrder[]> {
    return await tx
      .select({
        id: constructionOrdersTable.id,
        planetId: constructionOrdersTable.planetId,
        type: constructionOrdersTable.type,
        site: constructionOrdersTable.site,
        cost: constructionOrdersTable.cost,
      })
      .from(constructionOrdersTable)
      .where(
        and(
          eq(constructionOrdersTable.gameId, gameId),
          eq(constructionOrdersTable.turn, turn),
          eq(constructionOrdersTable.playerId, playerId),
        ),
      )
      .orderBy(constructionOrdersTable.id)
  }

  public async getConstructionInputs(
    target: { gameId: GameId; turn: number; playerId: PlayerId; planetId: PlanetId },
    tx: Transaction,
  ): Promise<{
    planet: Pick<Planet, "id" | "ownerPlayerId" | "area"> | undefined
    buildings: Array<Pick<Building, "type" | "site" | "planetId">>
    orders: ConstructionOrder[]
    available: string
  }> {
    const [planet] = await tx
      .select({ id: planetsTable.id, ownerPlayerId: planetsTable.ownerPlayerId, area: planetsTable.area })
      .from(planetsTable)
      .where(and(eq(planetsTable.gameId, target.gameId), eq(planetsTable.id, target.planetId)))
    const buildings = await tx
      .select({ type: buildingsTable.type, site: buildingsTable.site, planetId: buildingsTable.planetId })
      .from(buildingsTable)
      .where(and(eq(buildingsTable.gameId, target.gameId), eq(buildingsTable.planetId, target.planetId)))
    const { orders, available } = await this.getOrderBudget(target, tx)
    return { planet, buildings, orders, available }
  }

  private async getOrderBudget(
    target: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<{ orders: ConstructionOrder[]; moves: Array<typeof moveOrdersTable.$inferSelect>; available: string }> {
    const [player] = await tx
      .select({ balance: sql<string | null>`${playersTable.creditBalance}::text` })
      .from(playersTable)
      .where(and(eq(playersTable.gameId, target.gameId), eq(playersTable.playerId, target.playerId)))
    Assert.isDefined(player)
    Assert.isTrue(player.balance !== null)
    const orders = await this.getConstructionOrders(target, tx)
    const moves = await this.getMoveOrders(target, tx)
    return { orders, moves, available: availableCredits(player.balance, [...orders, ...moves.map((move) => move.route)]) }
  }

  private async getMoveOrders(
    target: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<Array<typeof moveOrdersTable.$inferSelect>> {
    return await tx
      .select()
      .from(moveOrdersTable)
      .where(
        and(
          eq(moveOrdersTable.gameId, target.gameId),
          eq(moveOrdersTable.turn, target.turn),
          eq(moveOrdersTable.playerId, target.playerId),
        ),
      )
      .orderBy(moveOrdersTable.id)
  }

  public async getTravelBody(gameId: GameId, ref: BodyRef, tx: Transaction): Promise<TravelBody | undefined> {
    if (ref.kind === "star") {
      const [star] = await tx
        .select({ id: starsTable.id, name: starsTable.name, coordinates: starsTable.coordinates, x: starsTable.x, y: starsTable.y })
        .from(starsTable)
        .where(and(eq(starsTable.gameId, gameId), eq(starsTable.id, branded<StarId>(ref.id))))
      return star === undefined ? undefined : { ...star, kind: "star" }
    }
    const [planet] = await tx
      .select({ id: planetsTable.id, name: planetsTable.name, coordinates: planetsTable.coordinates, x: planetsTable.x, y: planetsTable.y })
      .from(planetsTable)
      .where(and(eq(planetsTable.gameId, gameId), eq(planetsTable.id, branded<PlanetId>(ref.id))))
    return planet === undefined ? undefined : { ...planet, kind: "planet" }
  }

  public async getMoveInputs(
    context: OpenPlanningTurn,
    playerId: PlayerId,
    shipId: ShipId,
    tx: Transaction,
  ): Promise<{
    ship: typeof shipsTable.$inferSelect | undefined
    origin: TravelBody | undefined
    availableCredits: string
    reserved: boolean
  }> {
    const [ship] = await tx
      .select()
      .from(shipsTable)
      .where(and(eq(shipsTable.gameId, context.gameId), eq(shipsTable.ownerPlayerId, playerId), eq(shipsTable.id, shipId)))
    const { available, moves } = await this.getOrderBudget({ ...context, playerId }, tx)
    let origin: TravelBody | undefined
    if (ship !== undefined && ship.trip === null) {
      if (ship.planetId !== null) {
        origin = await this.getTravelBody(context.gameId, { kind: "planet", id: ship.planetId }, tx)
      } else if (ship.starId !== null) {
        origin = await this.getTravelBody(context.gameId, { kind: "star", id: ship.starId }, tx)
      }
    }
    return { ship, origin, availableCredits: available, reserved: moves.some((move) => move.shipId === shipId) }
  }

  public async submitMove(
    context: OpenPlanningTurn,
    playerId: PlayerId,
    shipId: ShipId,
    route: TravelRoute,
    tx: Transaction,
  ): Promise<void> {
    await tx.insert(moveOrdersTable).values({ ...context, playerId, shipId, route })
  }
  public async cancelMove(context: OpenPlanningTurn, playerId: PlayerId, orderId: string, tx: Transaction): Promise<boolean> {
    const removed = await tx
      .delete(moveOrdersTable)
      .where(
        and(
          eq(moveOrdersTable.gameId, context.gameId),
          eq(moveOrdersTable.turn, context.turn),
          eq(moveOrdersTable.playerId, playerId),
          eq(moveOrdersTable.id, orderId),
        ),
      )
      .returning({ id: moveOrdersTable.id })
    return removed.length === 1
  }

  public async submitConstruction(
    context: OpenPlanningTurn,
    order: Omit<typeof constructionOrdersTable.$inferInsert, "id" | "gameId" | "turn">,
    tx: Transaction,
  ): Promise<void> {
    await tx.insert(constructionOrdersTable).values({ ...context, ...order })
  }

  public async cancelConstruction(
    { gameId, turn }: OpenPlanningTurn,
    { playerId, orderId }: { playerId: PlayerId; orderId: ConstructionOrder["id"] },
    tx: Transaction,
  ): Promise<boolean> {
    const removed = await tx
      .delete(constructionOrdersTable)
      .where(
        and(
          eq(constructionOrdersTable.gameId, gameId),
          eq(constructionOrdersTable.turn, turn),
          eq(constructionOrdersTable.playerId, playerId),
          eq(constructionOrdersTable.id, orderId),
        ),
      )
      .returning({ id: constructionOrdersTable.id })
    return removed.length === 1
  }

  public async updateReadiness({ context, isReady }: { context: ReadinessForUpdate; isReady: boolean }, tx: Transaction): Promise<void> {
    await tx
      .update(playersTable)
      .set({ isReady })
      .where(and(eq(playersTable.gameId, context.gameId), eq(playersTable.playerId, context.playerId)))
  }

  public async closeTurn({ context, closedAt }: { context: ReadinessForUpdate; closedAt: Date }, tx: Transaction): Promise<void> {
    await tx
      .update(turnsTable)
      .set({ closedAt, status: TurnStatus.AWAITING_PROCESSING })
      .where(and(eq(turnsTable.gameId, context.gameId), eq(turnsTable.turn, context.turn)))

    await tx
      .update(turnsProcessingTable)
      .set({ scheduledFor: closedAt })
      .where(and(eq(turnsProcessingTable.gameId, context.gameId), eq(turnsProcessingTable.turn, context.turn)))
  }
}

function toGalaxyModel({
  stars,
  planets,
}: {
  stars: ReadonlyArray<typeof starsTable.$inferSelect>
  planets: ReadonlyArray<PlayerView["galaxy"]["systems"][number]["planets"][number] & { starId: StarId }>
}): PlayerView["galaxy"] {
  const planetsByStarId = Map.groupBy(planets, (planet) => planet.starId)
  const systems = stars.map((star) => ({
    star: toStarModel(star),
    planets: planetsByStarId.get(star.id) ?? [],
  }))

  return { systems }
}

function toStarModel({ id, name, coordinates, x, y }: typeof starsTable.$inferSelect): Star {
  return { id, name, coordinates, x, y }
}
