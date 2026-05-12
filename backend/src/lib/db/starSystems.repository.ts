import { PostgresRepository } from "./PostgresRepository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "./schema.ts"
import { and, asc, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { PercentageRange, IntegerRange } from "#lib/Range.ts"
import type { BodyType } from "#lib/star-systems/BodyType.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

export type StarSystemWriteModel = {
  gameId: number
  generationSettings: StarSystemGenerationSettingsWriteModel
  orbits: OrbitWriteModel[]
  sectors: SectorWriteModel[]
  bodies: BodyWriteModel[]
  movementNodes: MovementNodeWriteModel[]
  movementEdges: MovementEdgeWriteModel[]
}

export type StarSystemGenerationSettingsWriteModel = {
  planetDensity: PercentageRange
  nbPlanets: IntegerRange
  nbMoonsPerPlanet: IntegerRange
  nbAsteroidBelts: IntegerRange
  nbAsteroidsPerSector: IntegerRange
  seed: number
}

export type OrbitWriteModel = {
  id: string
  orbitNumber: number
}

export type SectorWriteModel = {
  id: string
  orbitId: string
  sectorNumber: number
  movementNodeId: string
}

export type BodyWriteModel = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
  movementNodeId: string
}

export type MovementNodeWriteModel = {
  id: string
}

export type MovementEdgeWriteModel = {
  fromNodeId: string
  toNodeId: string
  weight: number
}

export type StarSystemReadModel = {
  gameId: number
  orbits: OrbitReadModel[]
  movementGraph: MovementGraphReadModel
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

export type MovementGraphReadModel = {
  edges: Record<string, MovementEdgeReadModel[]>
}

export type MovementEdgeReadModel = {
  from: string
  to: string
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

function createWithGameId(
  gameId: StarSystemWriteModel["gameId"],
): <T extends Record<string, unknown>>(data: T) => T & Pick<StarSystemWriteModel, "gameId"> {
  return (data) => ({ ...data, gameId })
}

export class StarSystemsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "star-systems-repository" })
  }

  public async create(system: StarSystemWriteModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(async (): Promise<true> => {
      await db.transaction(async (tx) => {
        const withGameId = createWithGameId(system.gameId)

        await tx.insert(starSystemsTable).values(withGameId({ generationSettings: system.generationSettings }))

        const movementNodes = system.movementNodes.map(withGameId)
        if (movementNodes.length > 0) {
          await tx.insert(movementNodesTable).values(movementNodes)
        }

        const movementEdges = system.movementEdges.map(withGameId)
        if (movementEdges.length > 0) {
          await tx.insert(movementEdgesTable).values(movementEdges)
        }

        const orbits = system.orbits.map(withGameId)
        if (orbits.length > 0) {
          await tx.insert(orbitsTable).values(orbits)
        }

        const sectors = system.sectors.map(withGameId)
        if (sectors.length > 0) {
          await tx.insert(sectorsTable).values(sectors)
        }

        const bodies = system.bodies.map(withGameId)
        if (bodies.length > 0) {
          await tx.insert(bodiesTable).values(bodies)
        }
      })

      return true
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create Star System", { system, error: createResult.error })
      return Result.Failure(couldNot("create Star System"))
    }

    return createResult
  }

  public async getByGameId(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemReadModel | undefined, string>> {
    const getRowsResult = await this.getStarSystemAggregatedRows({ gameId }, db)
    if (Result.isFailure(getRowsResult)) {
      return getRowsResult
    }

    if (getRowsResult.value === undefined) {
      return Result.Success(undefined)
    }

    return Result.Success(toStarSystem(getRowsResult.value))
  }

  public async areNeighbors(
    {
      gameId,
      fromMovementNodeId,
      toMovementNodeId,
    }: {
      gameId: number
      fromMovementNodeId: string
      toMovementNodeId: string
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const getResult = await Result.tryCatch(
      async () =>
        await db
          .select({ fromNodeId: movementEdgesTable.fromNodeId })
          .from(movementEdgesTable)
          .where(
            and(
              eq(movementEdgesTable.gameId, gameId),
              eq(movementEdgesTable.fromNodeId, fromMovementNodeId),
              eq(movementEdgesTable.toNodeId, toMovementNodeId),
            ),
          ),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not check Star System movement neighbors", {
        gameId,
        fromMovementNodeId,
        toMovementNodeId,
        error: getResult.error,
      })
      return Result.Failure(couldNot("check Star System movement neighbors"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] !== undefined)
  }

  private async getStarSystemAggregatedRows(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"],
  ): Promise<Result<StarSystemAggregatedRows | undefined, string>> {
    const rowsResult = await Result.tryCatch(async () => {
      const starSystems = await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, gameId))
      Assert.isTrue(starSystems.length <= 1)

      const starSystem = starSystems[0]
      if (starSystem === undefined) {
        return undefined
      }

      const systemOrbits = await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, gameId)).orderBy(asc(orbitsTable.orbitNumber))

      const systemSectors = await db
        .select()
        .from(sectorsTable)
        .where(eq(sectorsTable.gameId, gameId))
        .orderBy(asc(sectorsTable.sectorNumber))

      const systemBodies = await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, gameId)).orderBy(asc(bodiesTable.bodyNumber))

      const systemMovementEdges = await db
        .select()
        .from(movementEdgesTable)
        .where(eq(movementEdgesTable.gameId, gameId))
        .orderBy(asc(movementEdgesTable.fromNodeId), asc(movementEdgesTable.toNodeId))

      return {
        starSystem,
        orbits: systemOrbits,
        sectors: systemSectors,
        bodies: systemBodies,
        movementEdges: systemMovementEdges,
      }
    })

    if (Result.isFailure(rowsResult)) {
      this.logger.error("Could not get Star System rows", { gameId, error: rowsResult.error })
      return Result.Failure(couldNot("get Star System rows"))
    }

    return Result.Success(rowsResult.value)
  }
}

function toStarSystem(starSystemRows: StarSystemAggregatedRows): StarSystemReadModel {
  const bodiesBySectorId = new Map<string, BodyRow[]>()
  for (const body of starSystemRows.bodies) {
    bodiesBySectorId.set(body.sectorId, [...(bodiesBySectorId.get(body.sectorId) ?? []), body])
  }

  const sectorsByOrbitId = new Map<string, SectorRow[]>()
  for (const sector of starSystemRows.sectors) {
    sectorsByOrbitId.set(sector.orbitId, [...(sectorsByOrbitId.get(sector.orbitId) ?? []), sector])
  }

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
    movementGraph: toMovementGraph(starSystemRows.movementEdges),
  }
}

function toMovementGraph(edges: MovementEdgeRow[]): MovementGraphReadModel {
  const movementGraph: MovementGraphReadModel = { edges: {} }

  for (const edge of edges) {
    const nodeEdges = movementGraph.edges[edge.fromNodeId] ?? []
    nodeEdges.push({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      weight: edge.weight,
    })
    movementGraph.edges[edge.fromNodeId] = nodeEdges
  }

  return movementGraph
}
