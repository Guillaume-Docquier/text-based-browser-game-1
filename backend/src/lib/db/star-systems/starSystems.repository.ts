import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { BodyType } from "#lib/star-systems/BodyType.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

const RANGE_NUMERIC_TYPES = ["float", "integer"] as const
const RANGE_MAX_BOUND_TYPES = ["inclusive", "exclusive"] as const

type StarSystemRow = typeof starSystemsTable.$inferSelect
type OrbitRow = typeof orbitsTable.$inferSelect
type SectorRow = typeof sectorsTable.$inferSelect
type NewSectorRow = Omit<typeof sectorsTable.$inferInsert, "gameId">
type BodyRow = typeof bodiesTable.$inferSelect
type MovementEdgeRow = typeof movementEdgesTable.$inferSelect

export type NewStarSystemModel = {
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

export type StarSystemModel = {
  gameId: number
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

export class StarSystemsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "star-systems-repository" })
  }

  /**
   * Create a new star system.
   * It is your responsibility to provide coherent data. Failing to do so will result in a Failure.
   */
  public async create(newStarSystem: NewStarSystemModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(
      db.transaction(async (tx) => {
        const withGameId = createWithGameId(newStarSystem.gameId)

        await tx.insert(starSystemsTable).values(withGameId({}))

        const movementNodes = newStarSystem.movementNodes.map(withGameId)
        if (movementNodes.length > 0) {
          await tx.insert(movementNodesTable).values(movementNodes)
        }

        const movementEdges = newStarSystem.movementEdges.map(withGameId)
        if (movementEdges.length > 0) {
          await tx.insert(movementEdgesTable).values(movementEdges)
        }

        const orbits = newStarSystem.orbits.map(withGameId)
        if (orbits.length > 0) {
          await tx.insert(orbitsTable).values(orbits)
        }

        const sectors = newStarSystem.sectors.map(toNewSectorRow).map(withGameId)
        if (sectors.length > 0) {
          await tx.insert(sectorsTable).values(sectors)
        }

        const bodies = newStarSystem.bodies.map(withGameId)
        if (bodies.length > 0) {
          await tx.insert(bodiesTable).values(bodies)
        }
      }),
    )

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create Star System", { system: newStarSystem, error: createResult.error })
      return Result.Failure(couldNot("create Star System"))
    }

    return Result.Success(true)
  }

  /**
   * Gets a star system by gameId.
   * Returns undefined if no star system exists for the game, probably meaning that the game has not started yet, but could also mean the game doesn't exist.
   */
  public async getByGameId(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemModel | undefined, string>> {
    const getRowsResult = await Result.tryCatch(async () => {
      const starSystems = await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, gameId))
      Assert.isTrue(starSystems.length <= 1)

      const starSystem = starSystems[0]
      if (starSystem === undefined) {
        return undefined
      }

      const orbits = await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, gameId))
      const sectors = await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, gameId))
      const bodies = await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, gameId))
      const movementEdges = await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, gameId))

      return {
        starSystem,
        orbits,
        sectors,
        bodies,
        movementEdges,
      }
    })

    if (Result.isFailure(getRowsResult)) {
      this.logger.error("Could not get Star System rows", { gameId, error: getRowsResult.error })
      return Result.Failure(couldNot("get Star System rows"))
    }

    if (getRowsResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toStarSystemModel(getRowsResult.value))
  }
}

function toStarSystemModel(starSystemRows: StarSystemAggregatedRows): StarSystemModel {
  const bodiesBySectorId = Map.groupBy(starSystemRows.bodies, ({ sectorId }) => sectorId)
  const sectorsByOrbitId = Map.groupBy(starSystemRows.sectors, ({ orbitId }) => orbitId)

  // It's a bit monstrous, but it's localized and does exactly what it need to
  return {
    gameId: starSystemRows.starSystem.gameId,
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

function createWithGameId(
  gameId: NewStarSystemModel["gameId"],
): <T extends Record<string, unknown>>(data: T) => T & Pick<NewStarSystemModel, "gameId"> {
  return (data) => ({ ...data, gameId })
}

function toMovementEdgesByFromNodeId(edges: MovementEdgeRow[]): StarSystemModel["movementEdges"] {
  // We cast because Object.groupBy returns a Partial<Record<string, T>>, which makes TypeScript think
  // That T could be undefined because of Partial
  // Kinda strange
  return Object.groupBy(edges, ({ fromNodeId }) => fromNodeId) as StarSystemModel["movementEdges"]
}
