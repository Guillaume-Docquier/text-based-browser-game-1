import { PostgresRepository } from "./PostgresRepository.ts"
import {
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
import type { BodyType } from "#lib/world-maps/BodyType.ts"
import { toCoordinates } from "#lib/world-maps/Coordinates.ts"

export type StarSystemWriteModel = {
  gameId: number
  generationSettings: MapGenerationSettingsWriteModel
  orbits: OrbitWriteModel[]
  movementEdges: MovementEdgeWriteModel[]
}

export type MapGenerationSettingsWriteModel = {
  planetDensityOfSystem: PercentageRange
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
  id: number
  number: number
  coordinates: string
  sectors: SectorReadModel[]
}

export type SectorReadModel = {
  id: number
  number: number
  coordinates: string
  bodies: BodyReadModel[]
  movementNodeId: number
}

export type BodyReadModel = {
  id: number
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: number
}

export type MovementGraphReadModel = {
  edges: Record<string, MovementEdgeReadModel[]>
}

export type MovementEdgeReadModel = {
  from: number
  to: number
  weight: number
}

type GameMapRow = typeof gameMapsTable.$inferSelect
type GameMapOrbitRow = typeof gameMapOrbitsTable.$inferSelect
type GameMapSectorRow = typeof gameMapSectorsTable.$inferSelect
type GameMapBodyRow = typeof gameMapBodiesTable.$inferSelect
type GameMapMovementEdgeRow = typeof gameMapMovementEdgesTable.$inferSelect

type WorldMapReadModel = {
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

  public async createSystem(system: StarSystemWriteModel, db: PostgresRepository["db"] = this.db): Promise<Result<true, string>> {
    const createSystemResult = await Result.tryCatch(async (): Promise<true> => {
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

    if (Result.isFailure(createSystemResult)) {
      this.logger.error("Could not create Star System", { system, error: createSystemResult.error })
      return Result.Failure(couldNot("create Star System"))
    }

    return createSystemResult
  }

  public async getStarSystem(
    { gameId }: { gameId: number },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemReadModel, string>> {
    const getStarSystemResult = await Result.tryCatch(async () => {
      const getWorldMapResult = await this.getWorldMap({ gameId }, db)
      if (Result.isFailure(getWorldMapResult)) {
        throw new Error(`Cannot get Star System: ${getWorldMapResult.error}`)
      }

      return toStarSystem(getWorldMapResult.value)
    })

    if (Result.isFailure(getStarSystemResult)) {
      this.logger.error("Could not get Star System", { gameId, error: getStarSystemResult.error })
      return Result.Failure(couldNot("get Star System"))
    }

    return getStarSystemResult
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

  private async getWorldMap({ gameId }: { gameId: number }, db: PostgresRepository["db"]): Promise<Result<WorldMapReadModel, string>> {
    const maps = await db.select().from(gameMapsTable).where(eq(gameMapsTable.gameId, gameId))
    Assert.isTrue(maps.length <= 1)

    const map = maps[0]
    if (map === undefined) {
      return Result.Failure(`No world map found for game id ${gameId}`)
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

    return Result.Success({ map, orbits, sectors, bodies, movementEdges })
  }
}

function getMovementNodeKeys(system: StarSystemWriteModel): string[] {
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

function toStarSystem(worldMap: WorldMapReadModel): StarSystemReadModel {
  const bodiesBySectorId = new Map<number, GameMapBodyRow[]>()
  for (const body of worldMap.bodies) {
    bodiesBySectorId.set(body.sectorId, [...(bodiesBySectorId.get(body.sectorId) ?? []), body])
  }

  const sectorsByOrbitId = new Map<number, GameMapSectorRow[]>()
  for (const sector of worldMap.sectors) {
    sectorsByOrbitId.set(sector.orbitId, [...(sectorsByOrbitId.get(sector.orbitId) ?? []), sector])
  }

  return {
    gameId: worldMap.map.gameId,
    orbits: worldMap.orbits.map((orbit) => ({
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
    movementGraph: toMovementGraph(worldMap.movementEdges),
  }
}

function toMovementGraph(edges: GameMapMovementEdgeRow[]): MovementGraphReadModel {
  const movementGraph: MovementGraphReadModel = { edges: {} }

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
