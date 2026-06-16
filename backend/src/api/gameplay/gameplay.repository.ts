import { Assert, type Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { and, eq } from "drizzle-orm"
import type { AccountId } from "#api/accounts/AccountId.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { PlayerId } from "#api/shared/PlayerId.ts"
import { toCoordinates } from "#api/star-systems/Coordinates.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import type { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { ResourceType } from "#lib/db/gameplay/gameResources.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import {
  bodiesTable,
  gamesTable,
  gameStatesTable,
  movementEdgesTable,
  movementNodesTable,
  orbitsTable,
  ordersTable,
  playersTable,
  resourcesTable,
  sectorsTable,
  starSystemsTable,
  ticksTable,
} from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"
import type { BodyType } from "#lib/star-systems/BodyType.ts"

type NewGameStateRow = typeof gameStatesTable.$inferInsert
type OrderRow = typeof ordersTable.$inferSelect
type NewResourceRow = typeof resourcesTable.$inferInsert
type NewTickRow = typeof ticksTable.$inferInsert
type NewSectorRow = Omit<typeof sectorsTable.$inferInsert, "gameId">

export type OrderModel = OrderRow

export type PlayerViewModel = {
  gameId: number
  playerId: PlayerId
  tick: number
  nextTickAt: Date
  starSystem: StarSystemModel
  resources: {
    money: number
  }
}

const RANGE_NUMERIC_TYPES = ["float", "integer"] as const
const RANGE_MAX_BOUND_TYPES = ["inclusive", "exclusive"] as const

type StarSystemRow = typeof starSystemsTable.$inferSelect
type OrbitRow = typeof orbitsTable.$inferSelect
type SectorRow = typeof sectorsTable.$inferSelect
type BodyRow = typeof bodiesTable.$inferSelect
type MovementEdgeRow = typeof movementEdgesTable.$inferSelect

export type NewStarSystemModel = {
  orbits: NewOrbitModel[]
  sectors: NewSectorModel[]
  bodies: NewBodyModel[]
  movementNodes: NewMovementNodeModel[]
  movementEdges: NewMovementEdgeModel[]
}

export type NewOrbitModel = {
  id: string
  orbitNumber: number
}

export type NewSectorModel = {
  id: string
  orbitId: string
  sectorNumber: number
  angleRange: Range
  movementNodeId: string
}

export type NewBodyModel = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
  movementNodeId: string
}

export type NewMovementNodeModel = {
  id: string
}

export type NewMovementEdgeModel = {
  fromNodeId: string
  toNodeId: string
  weight: number
}

export type StarSystemModel = {
  /**
   * Star system as a tree
   */
  orbits: OrbitModel[]
  /**
   * Movement edges by movement node id
   */
  movementEdges: Record<string, MovementEdgeModel[]>
}

export type OrbitModel = {
  id: string
  number: number
  coordinates: string
  sectors: SectorModel[]
}

export type SectorModel = {
  id: string
  number: number
  coordinates: string
  angleRange: Range
  bodies: BodyModel[]
  movementNodeId: string
}

export type BodyModel = {
  id: string
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: string
}

export type MovementEdgeModel = {
  fromNodeId: string
  toNodeId: string
  weight: number
}

type StarSystemAggregatedRows = {
  starSystem: StarSystemRow
  orbits: OrbitRow[]
  sectors: SectorRow[]
  bodies: BodyRow[]
  movementEdges: MovementEdgeRow[]
}

export type StartGameModel = {
  gameId: GameId
  startedAt: Date
  nextTickAt: Date
  starSystem: NewStarSystemModel
  players: Record<
    PlayerId,
    {
      resources: Array<{
        resourceType: ResourceType
        amount: number
      }>
    }
  >
}

/**
 * As the repository grows in size because of the models, we'll want to start extracting models/queries in their own files to keep it manageable.
 */
export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
  }

  public async startGame(
    startGameModel: StartGameModel,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<{ nextTickAt: Date }, string>> {
    const gameState = {
      gameId: startGameModel.gameId,
      tick: 0,
      nextTickAt: startGameModel.nextTickAt,
    } as const satisfies NewGameStateRow

    const playerResources: NewResourceRow[] = Object.entries(startGameModel.players).flatMap(([playerId, { resources }]) =>
      resources.map((resource) => ({
        gameId: startGameModel.gameId,
        playerId,
        ...resource,
      })),
    )
    Assert.isTrue(playerResources.length > 0)

    const gameTick: NewTickRow = {
      gameId: startGameModel.gameId,
      tick: gameState.tick,
      scheduledFor: startGameModel.nextTickAt,
    }

    const startResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        await tx.update(gamesTable).set({ startedAt: startGameModel.startedAt }).where(eq(gamesTable.id, startGameModel.gameId))
        await tx.insert(gameStatesTable).values(gameState)
        await tx.insert(resourcesTable).values(playerResources)
        await tx.insert(ticksTable).values(gameTick)
        await insertStarSystem({ gameId: startGameModel.gameId, starSystem: startGameModel.starSystem }, tx)
      }),
    )

    if (Result.isFailure(startResult)) {
      this.logger.error("Could not start game", { startGameModel, error: startResult.error })
      return Result.Failure(couldNot("start game"))
    }

    return Result.Success({ nextTickAt: gameState.nextTickAt })
  }

  public async getPlayerIds({ gameId }: { gameId: GameId }, db: PostgresRepository["db"] = this.db): Promise<Result<PlayerId[], string>> {
    const gamePlayersResult = await Result.tryCatch(
      db.select({ playerId: playersTable.playerId }).from(playersTable).where(eq(playersTable.gameId, gameId)),
    )

    if (Result.isFailure(gamePlayersResult)) {
      this.logger.error("Could not get player ids", { gameId, error: gamePlayersResult.error })
      return Result.Failure(couldNot("get player ids"))
    }

    return Result.Success(gamePlayersResult.value.map(({ playerId }) => playerId))
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

        const starSystem = await selectStarSystem(gameId, tx)

        const playerResources = await tx
          .select()
          .from(resourcesTable)
          .where(and(eq(resourcesTable.gameId, gameId), eq(resourcesTable.playerId, playerId)))
        const money = playerResources.find((resource) => resource.resourceType === ResourceType.MONEY)
        Assert.isDefined(money)

        return {
          ...gameState,
          playerId,
          starSystem,
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

  public async getCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel | null, string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player action", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player action"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] ?? null)
  }

  public async setCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number; actionType: GamePlayerActionType },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel, string>> {
    const upsertResult = await Result.tryCatch(async () => {
      const updatedAt = new Date()
      const gamePlayerActions = await db
        .insert(ordersTable)
        .values({ ...params, updatedAt })
        .onConflictDoUpdate({
          target: [ordersTable.gameId, ordersTable.playerId, ordersTable.tick],
          set: {
            actionType: params.actionType,
            updatedAt,
          },
        })
        .returning()

      Assert.isTrue(gamePlayerActions.length === 1)
      Assert.isDefined(gamePlayerActions[0])

      return gamePlayerActions[0]
    })

    if (Result.isFailure(upsertResult)) {
      this.logger.error("Could not upsert game player action", { ...params, error: upsertResult.error })
      return Result.Failure(couldNot("upsert game player action"))
    }

    return upsertResult
  }

  public async clearCurrentAction(
    params: { gameId: GameId; playerId: PlayerId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const deleteResult = await Result.tryCatch(
      db
        .delete(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.playerId, params.playerId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(deleteResult)) {
      this.logger.error("Could not delete game player action", { ...params, error: deleteResult.error })
      return Result.Failure(couldNot("delete game player action"))
    }

    return Result.Success(true)
  }

  public async getActionsForTick(
    params: { gameId: GameId; tick: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<OrderModel[], string>> {
    const getResult = await Result.tryCatch(
      db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.gameId, params.gameId), eq(ordersTable.tick, params.tick))),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get game player actions by tick", { ...params, error: getResult.error })
      return Result.Failure(couldNot("get game player actions by tick"))
    }

    return Result.Success(getResult.value)
  }

  public async endGameWithWinner(
    { gameId, winnerAccountId }: { gameId: GameId; winnerAccountId: AccountId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const endResult = await Result.tryCatch(
      db.update(gamesTable).set({ endedAt: new Date(), winnerAccountId }).where(eq(gamesTable.id, gameId)),
    )

    if (Result.isFailure(endResult)) {
      this.logger.error("Could not end game with winner", { gameId, winnerAccountId, error: endResult.error })
      return Result.Failure(couldNot("end game with winner"))
    }

    return Result.Success(true)
  }

  public async updateGameState(
    { gameId }: { gameId: GameId },
    gameState: Partial<NewGameStateRow>,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<true, string>> {
    const updateResult = await Result.tryCatch(db.update(gameStatesTable).set(gameState).where(eq(gameStatesTable.gameId, gameId)))

    if (Result.isFailure(updateResult)) {
      this.logger.error("Could not update game state", { gameId, gameState, error: updateResult.error })
      return Result.Failure(couldNot("update game state"))
    }

    return Result.Success(true)
  }
}

async function insertStarSystem(
  { gameId, starSystem }: { gameId: GameId; starSystem: NewStarSystemModel },
  tx: Transaction,
): Promise<void> {
  const withGameId = createWithGameId(gameId)

  await tx.insert(starSystemsTable).values(withGameId({}))

  const movementNodes = starSystem.movementNodes.map(withGameId)
  if (movementNodes.length > 0) {
    await tx.insert(movementNodesTable).values(movementNodes)
  }

  const movementEdges = starSystem.movementEdges.map(withGameId)
  if (movementEdges.length > 0) {
    await tx.insert(movementEdgesTable).values(movementEdges)
  }

  const orbits = starSystem.orbits.map(withGameId)
  if (orbits.length > 0) {
    await tx.insert(orbitsTable).values(orbits)
  }

  const sectors = starSystem.sectors.map(toNewSectorRow).map(withGameId)
  if (sectors.length > 0) {
    await tx.insert(sectorsTable).values(sectors)
  }

  const bodies = starSystem.bodies.map(withGameId)
  if (bodies.length > 0) {
    await tx.insert(bodiesTable).values(bodies)
  }
}

async function selectStarSystem(gameId: GameId, tx: Transaction): Promise<StarSystemModel> {
  const starSystems = await tx.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, gameId))
  Assert.isTrue(starSystems.length === 1)
  Assert.isDefined(starSystems[0])

  const starSystem = starSystems[0]
  const orbits = await tx.select().from(orbitsTable).where(eq(orbitsTable.gameId, gameId))
  const sectors = await tx.select().from(sectorsTable).where(eq(sectorsTable.gameId, gameId))
  const bodies = await tx.select().from(bodiesTable).where(eq(bodiesTable.gameId, gameId))
  const movementEdges = await tx.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, gameId))

  return toStarSystemModel({ starSystem, orbits, sectors, bodies, movementEdges })
}

function toNewSectorRow(newSector: NewSectorModel): NewSectorRow {
  return {
    id: newSector.id,
    orbitId: newSector.orbitId,
    sectorNumber: newSector.sectorNumber,
    angleNumericType: newSector.angleRange.numericType,
    angleMaxBoundType: newSector.angleRange.maxBoundType,
    startAngleDegrees: newSector.angleRange.min,
    endAngleDegrees: newSector.angleRange.max,
    movementNodeId: newSector.movementNodeId,
  }
}

function createWithGameId(gameId: GameId): <T extends Record<string, unknown>>(data: T) => T & { gameId: GameId } {
  return (data) => ({ ...data, gameId })
}

export function toStarSystemModel(starSystemRows: StarSystemAggregatedRows): StarSystemModel {
  const bodiesBySectorId = Map.groupBy(starSystemRows.bodies, ({ sectorId }) => sectorId)
  const sectorsByOrbitId = Map.groupBy(starSystemRows.sectors, ({ orbitId }) => orbitId)

  // It's a bit monstrous, but it's localized and does exactly what it need to
  return {
    orbits: starSystemRows.orbits.map((orbit) => ({
      id: orbit.id,
      number: orbit.orbitNumber,
      coordinates: toCoordinates({ orbitNumber: orbit.orbitNumber }),
      sectors: (sectorsByOrbitId.get(orbit.id) ?? []).map((sector) => ({
        id: sector.id,
        number: sector.sectorNumber,
        coordinates: toCoordinates({ orbitNumber: orbit.orbitNumber, sectorNumber: sector.sectorNumber }),
        angleRange: toSectorAngleRange(sector),
        movementNodeId: sector.movementNodeId,
        bodies: (bodiesBySectorId.get(sector.id) ?? []).map((body) => ({
          id: body.id,
          number: body.bodyNumber,
          coordinates: toCoordinates({ orbitNumber: orbit.orbitNumber, sectorNumber: sector.sectorNumber, bodyNumber: body.bodyNumber }),
          name: body.name,
          type: body.bodyType,
          movementNodeId: body.movementNodeId,
        })),
      })),
    })),
    movementEdges: toMovementEdgesByFromNodeId(starSystemRows.movementEdges),
  }
}

function toSectorAngleRange(sector: SectorRow): Range {
  Assert.isOneOf(RANGE_NUMERIC_TYPES, sector.angleNumericType, "sector.angleNumericType")
  Assert.isOneOf(RANGE_MAX_BOUND_TYPES, sector.angleMaxBoundType, "sector.angleMaxBoundType")

  return Range.create({
    numericType: sector.angleNumericType,
    maxBoundType: sector.angleMaxBoundType,
    min: sector.startAngleDegrees,
    max: sector.endAngleDegrees,
  })
}

function toMovementEdgesByFromNodeId(edges: MovementEdgeRow[]): StarSystemModel["movementEdges"] {
  // We cast because Object.groupBy returns a Partial<Record<string, T>>, which makes TypeScript think
  // That T could be undefined because of Partial
  // Kinda strange
  return Object.groupBy(edges, ({ fromNodeId }) => fromNodeId) as StarSystemModel["movementEdges"]
}
