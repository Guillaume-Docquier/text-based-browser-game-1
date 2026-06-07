import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, mapsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { BodyType } from "#lib/maps/BodyType.ts"
import { toCoordinates } from "#lib/maps/Coordinates.ts"

const RANGE_NUMERIC_TYPES = ["float", "integer"] as const
const RANGE_MAX_BOUND_TYPES = ["inclusive", "exclusive"] as const

type MapRow = typeof mapsTable.$inferSelect
type OrbitRow = typeof orbitsTable.$inferSelect
type SectorRow = typeof sectorsTable.$inferSelect
type NewSectorRow = Omit<typeof sectorsTable.$inferInsert, "gameId">
type BodyRow = typeof bodiesTable.$inferSelect
type MovementEdgeRow = typeof movementEdgesTable.$inferSelect

export type NewMapModel = {
  gameId: number
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

export type MapModel = {
  gameId: number
  /**
   * Map as a tree
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

type MapAggregatedRows = {
  map: MapRow
  orbits: OrbitRow[]
  sectors: SectorRow[]
  bodies: BodyRow[]
  movementEdges: MovementEdgeRow[]
}

export class MapsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "maps-repository" })
  }

  /**
   * Create a new map.
   * It is your responsibility to provide coherent data. Failing to do so will result in a Failure.
   */
  public async create(newMap: NewMapModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const withGameId = createWithGameId(newMap.gameId)

        await tx.insert(mapsTable).values(withGameId({}))

        const movementNodes = newMap.movementNodes.map(withGameId)
        if (movementNodes.length > 0) {
          await tx.insert(movementNodesTable).values(movementNodes)
        }

        const movementEdges = newMap.movementEdges.map(withGameId)
        if (movementEdges.length > 0) {
          await tx.insert(movementEdgesTable).values(movementEdges)
        }

        const orbits = newMap.orbits.map(withGameId)
        if (orbits.length > 0) {
          await tx.insert(orbitsTable).values(orbits)
        }

        const sectors = newMap.sectors.map(toNewSectorRow).map(withGameId)
        if (sectors.length > 0) {
          await tx.insert(sectorsTable).values(sectors)
        }

        const bodies = newMap.bodies.map(withGameId)
        if (bodies.length > 0) {
          await tx.insert(bodiesTable).values(bodies)
        }
      }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create Map", { map: newMap, error: createResult.error })
      return Result.Failure(couldNot("create Map"))
    }

    return Result.Success(true)
  }

  /**
   * Gets a map by gameId.
   * Returns undefined if no map exists for the game, probably meaning that the game has not started yet, but could also mean the game doesn't exist.
   */
  public async getByGameId(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<MapModel | undefined, string>> {
    const getRowsResult = await Result.tryCatch(async () => {
      const maps = await db.select().from(mapsTable).where(eq(mapsTable.gameId, gameId))
      Assert.isTrue(maps.length <= 1)

      const map = maps[0]
      if (map === undefined) {
        return undefined
      }

      const orbits = await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, gameId))
      const sectors = await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, gameId))
      const bodies = await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, gameId))
      const movementEdges = await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, gameId))

      return {
        map,
        orbits,
        sectors,
        bodies,
        movementEdges,
      }
    })

    if (Result.isFailure(getRowsResult)) {
      this.logger.error("Could not get Map rows", { gameId, error: getRowsResult.error })
      return Result.Failure(couldNot("get Map rows"))
    }

    if (getRowsResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toMapModel(getRowsResult.value))
  }
}

function toMapModel(mapRows: MapAggregatedRows): MapModel {
  const bodiesBySectorId = Map.groupBy(mapRows.bodies, ({ sectorId }) => sectorId)
  const sectorsByOrbitId = Map.groupBy(mapRows.sectors, ({ orbitId }) => orbitId)

  // It's a bit monstrous, but it's localized and does exactly what it need to
  return {
    gameId: mapRows.map.gameId,
    orbits: mapRows.orbits.map((orbit) => ({
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
    movementEdges: toMovementEdgesByFromNodeId(mapRows.movementEdges),
  }
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

function createWithGameId(gameId: NewMapModel["gameId"]): <T extends Record<string, unknown>>(data: T) => T & Pick<NewMapModel, "gameId"> {
  return (data) => ({ ...data, gameId })
}

function toMovementEdgesByFromNodeId(edges: MovementEdgeRow[]): MapModel["movementEdges"] {
  // We cast because Object.groupBy returns a Partial<Record<string, T>>, which makes TypeScript think
  // That T could be undefined because of Partial
  // Kinda strange
  return Object.groupBy(edges, ({ fromNodeId }) => fromNodeId) as MapModel["movementEdges"]
}
