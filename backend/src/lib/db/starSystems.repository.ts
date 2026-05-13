import { PostgresRepository } from "./PostgresRepository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "./schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { PercentageRange, IntegerRange } from "#lib/Range.ts"
import type { BodyType } from "#lib/star-systems/BodyType.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

export type NewStarSystem = {
  gameId: number
  generationSettings: StarSystemGenerationSettings
  orbits: Orbit[]
  sectors: Sector[]
  bodies: Body[]
  movementNodes: MovementNode[]
  movementEdges: MovementEdge[]
}

export type StarSystemGenerationSettings = {
  planetDensity: PercentageRange
  nbPlanets: IntegerRange
  nbMoonsPerPlanet: IntegerRange
  nbAsteroidBelts: IntegerRange
  nbAsteroidsPerSector: IntegerRange
  seed: number
}

export type Orbit = {
  id: string
  orbitNumber: number
}

export type Sector = {
  id: string
  orbitId: string
  sectorNumber: number
  movementNodeId: string
}

export type Body = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
  movementNodeId: string
}

export type MovementNode = {
  id: string
}

export type MovementEdge = {
  fromNodeId: string
  toNodeId: string
  weight: number
}

export type StarSystemReadModel = {
  gameId: number
  /**
   * Star system as a tree
   */
  orbits: OrbitReadModel[]
  /**
   * Movement edges by movement node id
   */
  movementEdges: Record<string, MovementEdgeReadModel[]>
}

export type OrbitReadModel = {
  id: string
  number: number
  coordinates: string
  sectors: SectorReadModel[]
}

export type SectorReadModel = {
  id: string
  number: number
  coordinates: string
  bodies: BodyReadModel[]
  movementNodeId: string
}

export type BodyReadModel = {
  id: string
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: string
}

export type MovementEdgeReadModel = {
  fromNodeId: string
  toNodeId: string
  weight: number
}

type StarSystemRow = typeof starSystemsTable.$inferSelect
type OrbitRow = typeof orbitsTable.$inferSelect
type SectorRow = typeof sectorsTable.$inferSelect
type BodyRow = typeof bodiesTable.$inferSelect
type MovementEdgeRow = typeof movementEdgesTable.$inferSelect

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
  public async create(newStarSystem: NewStarSystem, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(async (): Promise<true> => {
      await db.transaction(async (tx) => {
        const withGameId = createWithGameId(newStarSystem.gameId)

        await tx.insert(starSystemsTable).values(withGameId({ generationSettings: newStarSystem.generationSettings }))

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

        const sectors = newStarSystem.sectors.map(withGameId)
        if (sectors.length > 0) {
          await tx.insert(sectorsTable).values(sectors)
        }

        const bodies = newStarSystem.bodies.map(withGameId)
        if (bodies.length > 0) {
          await tx.insert(bodiesTable).values(bodies)
        }
      })

      return true
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create Star System", { system: newStarSystem, error: createResult.error })
      return Result.Failure(couldNot("create Star System"))
    }

    return createResult
  }

  /**
   * Gets a star system by gameId.
   * Returns undefined if no star system exists for the game, probably meaning that the game has not started yet, but could also mean the game doesn't exist.
   */
  public async getByGameId(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemReadModel | undefined, string>> {
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

    return Result.Success(toStarSystemReadModel(getRowsResult.value))
  }
}

function toStarSystemReadModel(starSystemRows: StarSystemAggregatedRows): StarSystemReadModel {
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

function createWithGameId(
  gameId: NewStarSystem["gameId"],
): <T extends Record<string, unknown>>(data: T) => T & Pick<NewStarSystem, "gameId"> {
  return (data) => ({ ...data, gameId })
}

function toMovementEdgesByFromNodeId(edges: MovementEdgeRow[]): StarSystemReadModel["movementEdges"] {
  // We cast because Object.groupBy returns a Partial<Record<string, T>>, which makes Typescript think
  // That T could be undefined because of Partial
  // Kinda strange
  return Object.groupBy(edges, ({ fromNodeId }) => fromNodeId) as StarSystemReadModel["movementEdges"]
}
