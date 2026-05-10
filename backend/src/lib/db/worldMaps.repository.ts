import { PostgresRepository } from "./PostgresRepository.ts"
import {
  type BodyType,
  gameMapBodiesTable,
  gameMapMovementEdgesTable,
  gameMapMovementNodesTable,
  gameMapOrbitsTable,
  gameMapsTable,
  gameMapSectorsTable,
} from "./schema.ts"
import { and, asc, eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"
import type { PercentageRange, IntegerRange } from "#lib/Range.ts"

export type MapGenerationSettingsWriteModel = {
  planetDensityOfSystem: PercentageRange
  nbPlanets: IntegerRange
  nbMoonsPerPlanet: IntegerRange
  nbAsteroidBelts: IntegerRange
  nbAsteroidsPerSector: IntegerRange
  seed: number
}

export type MapGenerationSettingsReadModel = MapGenerationSettingsWriteModel

export type WorldMapMovementEdgeReadModel = {
  from: number
  to: number
  weight: number
}

export type WorldMapMovementGraphReadModel = {
  edges: Record<string, WorldMapMovementEdgeReadModel[]>
}

export type WorldMapBodyReadModel = {
  id: number
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: number
}

export type WorldMapSectorReadModel = {
  id: number
  number: number
  coordinates: string
  bodies: WorldMapBodyReadModel[]
  movementNodeId: number
}

export type WorldMapSectorDetailsReadModel = WorldMapSectorReadModel & {
  movementGraph: WorldMapMovementGraphReadModel
}

export type WorldMapBodyDetailsReadModel = WorldMapBodyReadModel & {
  orbitId: number
  orbitNumber: number
  orbitCoordinates: string
  sectorId: number
  sectorNumber: number
  sectorCoordinates: string
  movementGraph: WorldMapMovementGraphReadModel
}

export type WorldMapOrbitReadModel = {
  id: number
  number: number
  coordinates: string
  sectors: WorldMapSectorReadModel[]
}

export type WorldMapSystemReadModel = {
  gameId: number
  generationSettings: MapGenerationSettingsReadModel
  orbits: WorldMapOrbitReadModel[]
  movementGraph: WorldMapMovementGraphReadModel
}

export type WorldMapSystemWriteModel = {
  gameId: number
  generationSettings: MapGenerationSettingsWriteModel
  orbits: WorldMapOrbitWriteModel[]
  movementEdges: WorldMapMovementEdgeWriteModel[]
}

export type WorldMapOrbitWriteModel = {
  number: number
  sectors: WorldMapSectorWriteModel[]
}

export type WorldMapSectorWriteModel = {
  number: number
  movementNodeKey: string
  bodies: WorldMapBodyWriteModel[]
}

export type WorldMapBodyWriteModel = {
  number: number
  type: BodyType
  name: string
  movementNodeKey: string
}

export type WorldMapMovementEdgeWriteModel = {
  from: string
  to: string
  weight?: number | undefined
}

type WorldMapSectorSelector = { sectorId: number; coordinate?: never } | { sectorId?: never; coordinate: string }
type WorldMapBodySelector = { bodyId: number; coordinate?: never } | { bodyId?: never; coordinate: string }

export type WorldMapSectorLookupReadModel =
  | { status: "found"; sector: WorldMapSectorDetailsReadModel }
  | { status: "missing-map" }
  | { status: "missing-sector" }

export type WorldMapBodyLookupReadModel =
  | { status: "found"; body: WorldMapBodyDetailsReadModel }
  | { status: "missing-map" }
  | { status: "missing-body" }

type GameMapRow = typeof gameMapsTable.$inferSelect
type GameMapOrbitRow = typeof gameMapOrbitsTable.$inferSelect
type GameMapSectorRow = typeof gameMapSectorsTable.$inferSelect
type GameMapBodyRow = typeof gameMapBodiesTable.$inferSelect
type GameMapMovementEdgeRow = typeof gameMapMovementEdgesTable.$inferSelect

type WorldMapRows = {
  map: GameMapRow
  orbits: GameMapOrbitRow[]
  sectors: GameMapSectorRow[]
  bodies: GameMapBodyRow[]
  movementEdges: GameMapMovementEdgeRow[]
}

export class WorldMapsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "world-maps-repository" })
  }

  public async createSystem(system: WorldMapSystemWriteModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createResult = await Result.tryCatch(async (): Promise<true> => {
      await db.transaction(async (tx) => {
        await tx.insert(gameMapsTable).values({
          gameId: system.gameId,
          generationSettings: system.generationSettings,
        })

        const movementNodeKeys = getMovementNodeKeys(system)
        const movementNodeIdByKey = new Map<string, number>()
        if (movementNodeKeys.length > 0) {
          const movementNodes = await tx
            .insert(gameMapMovementNodesTable)
            .values(movementNodeKeys.map(() => ({ gameId: system.gameId })))
            .returning()
          Assert.isTrue(movementNodes.length === movementNodeKeys.length)

          for (const [index, movementNodeKey] of movementNodeKeys.entries()) {
            const movementNode = movementNodes[index]
            Assert.isDefined(movementNode)
            movementNodeIdByKey.set(movementNodeKey, movementNode.id)
          }
        }

        const orbitIdByNumber = new Map<number, number>()
        if (system.orbits.length > 0) {
          const orbits = await tx
            .insert(gameMapOrbitsTable)
            .values(system.orbits.map((orbit) => ({ gameId: system.gameId, orbitNumber: orbit.number })))
            .returning()
          Assert.isTrue(orbits.length === system.orbits.length)

          for (const orbit of orbits) {
            orbitIdByNumber.set(orbit.orbitNumber, orbit.id)
          }
        }

        const createSectors = system.orbits.flatMap((orbit) => {
          const orbitId = orbitIdByNumber.get(orbit.number)
          Assert.isDefined(orbitId)

          return orbit.sectors.map((sector) => ({
            gameId: system.gameId,
            orbitId,
            sectorNumber: sector.number,
            movementNodeId: getRequiredMovementNodeId(movementNodeIdByKey, sector.movementNodeKey),
          }))
        })

        const sectorIdByOrbitIdAndNumber = new Map<string, number>()
        if (createSectors.length > 0) {
          const sectors = await tx.insert(gameMapSectorsTable).values(createSectors).returning()
          Assert.isTrue(sectors.length === createSectors.length)

          for (const sector of sectors) {
            sectorIdByOrbitIdAndNumber.set(getSectorRowKey({ orbitId: sector.orbitId, sectorNumber: sector.sectorNumber }), sector.id)
          }
        }

        const createBodies = system.orbits.flatMap((orbit) => {
          const orbitId = orbitIdByNumber.get(orbit.number)
          Assert.isDefined(orbitId)

          return orbit.sectors.flatMap((sector) => {
            const sectorId = sectorIdByOrbitIdAndNumber.get(getSectorRowKey({ orbitId, sectorNumber: sector.number }))
            Assert.isDefined(sectorId)

            return sector.bodies.map((body) => ({
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
          await tx.insert(gameMapBodiesTable).values(createBodies)
        }

        const createMovementEdges = system.movementEdges.map((movementEdge) => ({
          gameId: system.gameId,
          fromNodeId: getRequiredMovementNodeId(movementNodeIdByKey, movementEdge.from),
          toNodeId: getRequiredMovementNodeId(movementNodeIdByKey, movementEdge.to),
          weight: movementEdge.weight ?? 1,
        }))

        if (createMovementEdges.length > 0) {
          await tx.insert(gameMapMovementEdgesTable).values(createMovementEdges)
        }
      })

      return true
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create world map system", { gameId: system.gameId, error: createResult.error })
      return Result.Failure(couldNot("create world map system"))
    }

    return createResult
  }

  public async getSystem(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<WorldMapSystemReadModel | undefined, string>> {
    const getResult = await Result.tryCatch(async () => {
      const rows = await this.getSystemRows({ gameId }, db)
      if (rows === undefined) {
        return undefined
      }

      return toWorldMapSystem(rows)
    })

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get world map system", { gameId, error: getResult.error })
      return Result.Failure(couldNot("get world map system"))
    }

    return getResult
  }

  public async getSector(
    { gameId, selector }: { gameId: number; selector: WorldMapSectorSelector },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<WorldMapSectorLookupReadModel, string>> {
    const getResult = await Result.tryCatch(async (): Promise<WorldMapSectorLookupReadModel> => {
      const rows = await this.getSystemRows({ gameId }, db)
      if (rows === undefined) {
        return { status: "missing-map" }
      }

      const system = toWorldMapSystem(rows)
      const sector = findSector(system, selector)
      if (sector === undefined) {
        return { status: "missing-sector" }
      }

      return {
        status: "found",
        sector: {
          ...sector,
          movementGraph: getLocalMovementGraph(system.movementGraph, [
            sector.movementNodeId,
            ...sector.bodies.map((body) => body.movementNodeId),
          ]),
        },
      }
    })

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get world map sector", { gameId, selector, error: getResult.error })
      return Result.Failure(couldNot("get world map sector"))
    }

    return getResult
  }

  public async getBody(
    { gameId, selector }: { gameId: number; selector: WorldMapBodySelector },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<WorldMapBodyLookupReadModel, string>> {
    const getResult = await Result.tryCatch(async (): Promise<WorldMapBodyLookupReadModel> => {
      const rows = await this.getSystemRows({ gameId }, db)
      if (rows === undefined) {
        return { status: "missing-map" }
      }

      const system = toWorldMapSystem(rows)
      const bodyWithContext = findBody(system, selector)
      if (bodyWithContext === undefined) {
        return { status: "missing-body" }
      }

      const { orbit, sector, body } = bodyWithContext

      return {
        status: "found",
        body: {
          ...body,
          orbitId: orbit.id,
          orbitNumber: orbit.number,
          orbitCoordinates: orbit.coordinates,
          sectorId: sector.id,
          sectorNumber: sector.number,
          sectorCoordinates: sector.coordinates,
          movementGraph: getLocalMovementGraph(system.movementGraph, [body.movementNodeId]),
        },
      }
    })

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get world map body", { gameId, selector, error: getResult.error })
      return Result.Failure(couldNot("get world map body"))
    }

    return getResult
  }

  public async areNeighbors(
    {
      gameId,
      fromMovementNodeId,
      toMovementNodeId,
    }: {
      gameId: number
      fromMovementNodeId: number
      toMovementNodeId: number
    },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<boolean, string>> {
    const getResult = await Result.tryCatch(
      async () =>
        await db
          .select({ fromNodeId: gameMapMovementEdgesTable.fromNodeId })
          .from(gameMapMovementEdgesTable)
          .where(
            and(
              eq(gameMapMovementEdgesTable.gameId, gameId),
              eq(gameMapMovementEdgesTable.fromNodeId, fromMovementNodeId),
              eq(gameMapMovementEdgesTable.toNodeId, toMovementNodeId),
            ),
          ),
    )

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not check world map movement neighbors", {
        gameId,
        fromMovementNodeId,
        toMovementNodeId,
        error: getResult.error,
      })
      return Result.Failure(couldNot("check world map movement neighbors"))
    }

    Assert.isTrue(getResult.value.length <= 1)
    return Result.Success(getResult.value[0] !== undefined)
  }

  private async getSystemRows({ gameId }: { gameId: number }, db: PostgresRepository["db"]): Promise<WorldMapRows | undefined> {
    const maps = await db.select().from(gameMapsTable).where(eq(gameMapsTable.gameId, gameId))
    Assert.isTrue(maps.length <= 1)

    const map = maps[0]
    if (map === undefined) {
      return undefined
    }

    const orbits = await db
      .select()
      .from(gameMapOrbitsTable)
      .where(eq(gameMapOrbitsTable.gameId, gameId))
      .orderBy(asc(gameMapOrbitsTable.orbitNumber))

    const sectors = await db
      .select()
      .from(gameMapSectorsTable)
      .where(eq(gameMapSectorsTable.gameId, gameId))
      .orderBy(asc(gameMapSectorsTable.sectorNumber))

    const bodies = await db
      .select()
      .from(gameMapBodiesTable)
      .where(eq(gameMapBodiesTable.gameId, gameId))
      .orderBy(asc(gameMapBodiesTable.bodyNumber))

    const movementEdges = await db
      .select()
      .from(gameMapMovementEdgesTable)
      .where(eq(gameMapMovementEdgesTable.gameId, gameId))
      .orderBy(asc(gameMapMovementEdgesTable.fromNodeId), asc(gameMapMovementEdgesTable.toNodeId))

    return { map, orbits, sectors, bodies, movementEdges }
  }
}

function getMovementNodeKeys(system: WorldMapSystemWriteModel): string[] {
  const movementNodeKeys = system.orbits.flatMap((orbit) =>
    orbit.sectors.flatMap((sector) => [sector.movementNodeKey, ...sector.bodies.map((body) => body.movementNodeKey)]),
  )
  const uniqueMovementNodeKeys = [...new Set(movementNodeKeys)]

  Assert.isTrue(uniqueMovementNodeKeys.length === movementNodeKeys.length)

  return uniqueMovementNodeKeys
}

function getRequiredMovementNodeId(movementNodeIdByKey: Map<string, number>, movementNodeKey: string): number {
  const movementNodeId = movementNodeIdByKey.get(movementNodeKey)
  Assert.isDefined(movementNodeId)

  return movementNodeId
}

function getSectorRowKey({ orbitId, sectorNumber }: { orbitId: number; sectorNumber: number }): string {
  return `${orbitId}:${sectorNumber}`
}

function toWorldMapSystem(rows: WorldMapRows): WorldMapSystemReadModel {
  const bodiesBySectorId = new Map<number, GameMapBodyRow[]>()
  for (const body of rows.bodies) {
    bodiesBySectorId.set(body.sectorId, [...(bodiesBySectorId.get(body.sectorId) ?? []), body])
  }

  const sectorsByOrbitId = new Map<number, GameMapSectorRow[]>()
  for (const sector of rows.sectors) {
    sectorsByOrbitId.set(sector.orbitId, [...(sectorsByOrbitId.get(sector.orbitId) ?? []), sector])
  }

  return {
    gameId: rows.map.gameId,
    generationSettings: rows.map.generationSettings as MapGenerationSettingsReadModel,
    orbits: rows.orbits.map((orbit) => ({
      id: orbit.id,
      number: orbit.orbitNumber,
      coordinates: formatCoordinates(orbit.orbitNumber),
      sectors: (sectorsByOrbitId.get(orbit.id) ?? []).map((sector) => ({
        id: sector.id,
        number: sector.sectorNumber,
        coordinates: formatCoordinates(orbit.orbitNumber, sector.sectorNumber),
        movementNodeId: sector.movementNodeId,
        bodies: (bodiesBySectorId.get(sector.id) ?? []).map((body) => ({
          id: body.id,
          number: body.bodyNumber,
          coordinates: formatCoordinates(orbit.orbitNumber, sector.sectorNumber, body.bodyNumber),
          name: body.name,
          type: body.bodyType,
          movementNodeId: body.movementNodeId,
        })),
      })),
    })),
    movementGraph: toMovementGraph(rows.movementEdges),
  }
}

function toMovementGraph(edges: GameMapMovementEdgeRow[]): WorldMapMovementGraphReadModel {
  const movementGraph: WorldMapMovementGraphReadModel = { edges: {} }

  for (const edge of edges) {
    const key = edge.fromNodeId.toString()
    const nodeEdges = movementGraph.edges[key] ?? []
    nodeEdges.push({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      weight: edge.weight,
    })
    movementGraph.edges[key] = nodeEdges
  }

  return movementGraph
}

function getLocalMovementGraph(movementGraph: WorldMapMovementGraphReadModel, movementNodeIds: number[]): WorldMapMovementGraphReadModel {
  const localMovementGraph: WorldMapMovementGraphReadModel = { edges: {} }

  for (const movementNodeId of movementNodeIds) {
    const key = movementNodeId.toString()
    const nodeEdges = movementGraph.edges[key] ?? []
    if (nodeEdges.length > 0) {
      localMovementGraph.edges[key] = nodeEdges
    }
  }

  return localMovementGraph
}

function findSector(system: WorldMapSystemReadModel, selector: WorldMapSectorSelector): WorldMapSectorReadModel | undefined {
  for (const orbit of system.orbits) {
    const sector = orbit.sectors.find((candidateSector) => {
      if (selector.sectorId !== undefined) {
        return candidateSector.id === selector.sectorId
      }

      return candidateSector.coordinates === selector.coordinate
    })

    if (sector !== undefined) {
      return sector
    }
  }

  return undefined
}

function findBody(
  system: WorldMapSystemReadModel,
  selector: WorldMapBodySelector,
): { orbit: WorldMapOrbitReadModel; sector: WorldMapSectorReadModel; body: WorldMapBodyReadModel } | undefined {
  for (const orbit of system.orbits) {
    for (const sector of orbit.sectors) {
      const body = sector.bodies.find((candidateBody) => {
        if (selector.bodyId !== undefined) {
          return candidateBody.id === selector.bodyId
        }

        return candidateBody.coordinates === selector.coordinate
      })

      if (body !== undefined) {
        return { orbit, sector, body }
      }
    }
  }

  return undefined
}

function formatCoordinates(...parts: number[]): string {
  return parts.map((part) => part.toString().padStart(2, "0")).join(":")
}
