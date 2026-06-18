import { Assert, Range } from "@guillaume-docquier/tools-ts"
import { eq } from "drizzle-orm"
import { toCoordinates } from "#api/gameplay/star-systems/Coordinates.ts"
import type { MovementNodeId } from "#api/gameplay/star-systems/MovementNodeId.ts"
import type { GameId } from "#api/shared/GameId.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "#lib/db/schema.ts"
import type { BodyType } from "#lib/db/star-systems/BodyType.ts"

type NewSectorRow = Omit<typeof sectorsTable.$inferInsert, "gameId">
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
  movementNodeId: MovementNodeId
}

export type NewBodyModel = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
  movementNodeId: MovementNodeId
}

export type NewMovementNodeModel = {
  id: MovementNodeId
}

export type NewMovementEdgeModel = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
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
  movementEdges: Record<MovementNodeId, MovementEdgeModel[]>
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
  movementNodeId: MovementNodeId
}

export type BodyModel = {
  id: string
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: MovementNodeId
}

export type MovementEdgeModel = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
  weight: number
}

type StarSystemAggregatedRows = {
  starSystem: StarSystemRow
  orbits: OrbitRow[]
  sectors: SectorRow[]
  bodies: BodyRow[]
  movementEdges: MovementEdgeRow[]
}

/**
 * To be used by the GameplayRepository only.
 */
export const StarSystemQueries = {
  insertStarSystem: async ({ gameId, starSystem }: { gameId: GameId; starSystem: NewStarSystemModel }, tx: Transaction): Promise<void> => {
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
  },

  selectStarSystem: async (gameId: GameId, tx: Transaction): Promise<StarSystemModel> => {
    const starSystems = await tx.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, gameId))
    Assert.isTrue(starSystems.length === 1)
    Assert.isDefined(starSystems[0])

    const starSystem = starSystems[0]
    const orbits = await tx.select().from(orbitsTable).where(eq(orbitsTable.gameId, gameId))
    const sectors = await tx.select().from(sectorsTable).where(eq(sectorsTable.gameId, gameId))
    const bodies = await tx.select().from(bodiesTable).where(eq(bodiesTable.gameId, gameId))
    const movementEdges = await tx.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, gameId))

    return toStarSystemModel({ starSystem, orbits, sectors, bodies, movementEdges })
  },
} as const

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

const RANGE_NUMERIC_TYPES = ["float", "integer"] as const
const RANGE_MAX_BOUND_TYPES = ["inclusive", "exclusive"] as const
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
