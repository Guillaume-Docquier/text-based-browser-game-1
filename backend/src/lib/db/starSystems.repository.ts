import { PostgresRepository } from "./PostgresRepository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "./schema.ts"
import { and, asc, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { randomUUID } from "node:crypto"
import { couldNot } from "#lib/errors.ts"
import type { PercentageRange, IntegerRange } from "#lib/Range.ts"
import type { BodyType } from "#lib/star-systems/BodyType.ts"
import { toCoordinates } from "#lib/star-systems/Coordinates.ts"

export type StarSystemWriteModel = {
  gameId: number
  generationSettings: StarSystemGenerationSettingsWriteModel
  orbits: OrbitWriteModel[]
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
  number: number
  sectors: SectorWriteModel[]
}

export type SectorWriteModel = {
  number: number
  movementNodeKey: string
  bodies: BodyWriteModel[]
}

export type BodyWriteModel = {
  number: number
  type: BodyType
  name: string
  movementNodeKey: string
}

export type MovementEdgeWriteModel = {
  from: string
  to: string
  weight?: number | undefined
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

type StarSystemRowsReadModel = {
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

  public async create(system: StarSystemWriteModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createSystemResult = await Result.tryCatch(async (): Promise<true> => {
      await db.transaction(async (tx) => {
        await tx.insert(starSystemsTable).values({
          gameId: system.gameId,
          generationSettings: system.generationSettings,
        })

        const movementNodeIdByKey = createMovementNodeIdByKey(system)
        const movementNodes = [...movementNodeIdByKey.values()].map((id) => ({ id, gameId: system.gameId }))
        if (movementNodes.length > 0) {
          await tx.insert(movementNodesTable).values(movementNodes)
        }

        const orbitIdByNumber = new Map<number, string>()
        const createOrbits = system.orbits.map((orbit) => {
          const id = randomUUID()
          orbitIdByNumber.set(orbit.number, id)

          return { id, gameId: system.gameId, orbitNumber: orbit.number }
        })
        if (createOrbits.length > 0) {
          await tx.insert(orbitsTable).values(createOrbits)
        }

        const sectorIdByOrbitIdAndNumber = new Map<string, string>()
        const createSectors = system.orbits.flatMap((orbit) => {
          const orbitId = orbitIdByNumber.get(orbit.number)
          Assert.isDefined(orbitId)

          return orbit.sectors.map((sector) => {
            const id = randomUUID()
            sectorIdByOrbitIdAndNumber.set(getSectorRowKey({ orbitId, sectorNumber: sector.number }), id)

            return {
              id,
              gameId: system.gameId,
              orbitId,
              sectorNumber: sector.number,
              movementNodeId: getRequiredMovementNodeId(movementNodeIdByKey, sector.movementNodeKey),
            }
          })
        })

        if (createSectors.length > 0) {
          await tx.insert(sectorsTable).values(createSectors)
        }

        const createBodies = system.orbits.flatMap((orbit) => {
          const orbitId = orbitIdByNumber.get(orbit.number)
          Assert.isDefined(orbitId)

          return orbit.sectors.flatMap((sector) => {
            const sectorId = sectorIdByOrbitIdAndNumber.get(getSectorRowKey({ orbitId, sectorNumber: sector.number }))
            Assert.isDefined(sectorId)

            return sector.bodies.map((body) => ({
              id: randomUUID(),
              gameId: system.gameId,
              sectorId,
              bodyNumber: body.number,
              bodyType: body.type,
              name: body.name,
              movementNodeId: getRequiredMovementNodeId(movementNodeIdByKey, body.movementNodeKey),
            }))
          })
        })

        if (createBodies.length > 0) {
          await tx.insert(bodiesTable).values(createBodies)
        }

        const createMovementEdges = system.movementEdges.map((movementEdge) => ({
          gameId: system.gameId,
          fromNodeId: getRequiredMovementNodeId(movementNodeIdByKey, movementEdge.from),
          toNodeId: getRequiredMovementNodeId(movementNodeIdByKey, movementEdge.to),
          weight: movementEdge.weight ?? 1,
        }))

        if (createMovementEdges.length > 0) {
          await tx.insert(movementEdgesTable).values(createMovementEdges)
        }
      })

      return true
    })

    if (Result.isFailure(createSystemResult)) {
      this.logger.error("Could not create Star System", { system, error: createSystemResult.error })
      return Result.Failure(couldNot("create Star System"))
    }

    return createSystemResult
  }

  public async getByGameId(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemReadModel | undefined, string>> {
    const getRowsResult = await this.getStarSystemRows({ gameId }, db)
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

  private async getStarSystemRows(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"],
  ): Promise<Result<StarSystemRowsReadModel | undefined, string>> {
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

function createMovementNodeIdByKey(system: StarSystemWriteModel): Map<string, string> {
  return new Map(getMovementNodeKeys(system).map((movementNodeKey) => [movementNodeKey, randomUUID()]))
}

function getMovementNodeKeys(system: StarSystemWriteModel): string[] {
  const movementNodeKeys = system.orbits.flatMap((orbit) =>
    orbit.sectors.flatMap((sector) => [sector.movementNodeKey, ...sector.bodies.map((body) => body.movementNodeKey)]),
  )
  const uniqueMovementNodeKeys = [...new Set(movementNodeKeys)]

  Assert.isTrue(uniqueMovementNodeKeys.length === movementNodeKeys.length)

  return uniqueMovementNodeKeys
}

function getRequiredMovementNodeId(movementNodeIdByKey: Map<string, string>, movementNodeKey: string): string {
  const movementNodeId = movementNodeIdByKey.get(movementNodeKey)
  Assert.isDefined(movementNodeId)

  return movementNodeId
}

function getSectorRowKey({ orbitId, sectorNumber }: { orbitId: string; sectorNumber: number }): string {
  return `${orbitId}:${sectorNumber}`
}

function toStarSystem(starSystemRows: StarSystemRowsReadModel): StarSystemReadModel {
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
