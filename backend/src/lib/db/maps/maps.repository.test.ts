import { describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { v4 } from "uuid"
import { Assert, Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createNewPlayerModelStub } from "#lib/db/players/NewPlayerModel.stub.ts"
import { PlayersRepository } from "#lib/db/players/players.repository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, mapsTable } from "#lib/db/schema.ts"
import { type NewSectorModel, type NewMapModel, MapsRepository } from "#lib/db/maps/maps.repository.ts"
import { BodyType } from "#lib/maps/BodyType.ts"
import { GamesController } from "#api/games/games.controller.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createNewGameDtoStub } from "#api/games/NewGameDto.stub.ts"
import type { Database } from "#lib/db/createDb.ts"
import { GameSettingsRepository } from "#lib/db/games/gameSettings.repository.ts"
import { GamePlayersRepository } from "#lib/db/games/gamePlayers.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"

describe("maps.repository", () => {
  describe("create", () => {
    it("should create a Map with orbits, bodies, and movement edges", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new PlayersRepository({ db, logger })
      const mapsRepository = new MapsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const player = extractSuccess(await playersRepository.create(createNewPlayerModelStub()))
      const game = extractSuccess(await gamesController.create(createNewGameDtoStub({ createdByPlayerId: player.id })))

      const map = createCoherentMap({ gameId: game.id })
      const firstSector = map.sectors[0]
      Assert.isDefined(firstSector)

      // Act
      const createMapResult = await mapsRepository.create(map)

      // Assert
      expect(createMapResult).toEqual(Result.Success(true))
      expect
        .soft(await db.select().from(mapsTable).where(eq(mapsTable.gameId, game.id)))
        .toEqual([{ createdAt: expect.any(Date), gameId: game.id }])
      expect
        .soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.id)))
        .toEqual([{ ...map.orbits[0], gameId: game.id }])
      expect
        .soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.id)))
        .toEqual([toStoredSector({ sector: firstSector, gameId: game.id })])
      expect
        .soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.id)))
        .toEqual(map.bodies.map((body) => ({ ...body, gameId: game.id })))
      expect
        .soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.id)))
        .toEqual(map.movementNodes.map((movementNode) => ({ ...movementNode, gameId: game.id })))
      expect
        .soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.id)))
        .toEqual([{ ...map.movementEdges[0], gameId: game.id }])
    })

    it("should fail one request when creating two maps concurrently for the same game", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new PlayersRepository({ db, logger })
      const mapsRepository = new MapsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const player = extractSuccess(await playersRepository.create(createNewPlayerModelStub()))
      const game = extractSuccess(await gamesController.create(createNewGameDtoStub({ createdByPlayerId: player.id })))

      const map1 = createCoherentMap({ gameId: game.id })
      const map2 = createCoherentMap({ gameId: game.id })

      // Act
      const createMapResults = await Promise.all([mapsRepository.create(map1), mapsRepository.create(map2)])

      // Assert
      expect(createMapResults).toEqual(expect.arrayContaining([Result.Success(true), Result.Failure(expect.any(String))]))
    })

    it("should rollback the full Map when one child row is incoherent", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new PlayersRepository({ db, logger })
      const mapsRepository = new MapsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const player = extractSuccess(await playersRepository.create(createNewPlayerModelStub()))
      const game = extractSuccess(await gamesController.create(createNewGameDtoStub({ createdByPlayerId: player.id })))

      const map = createIncoherentMap({ gameId: game.id })

      // Act
      const createMapResult = await mapsRepository.create(map)

      // Assert
      expect(createMapResult).toEqual(Result.Failure(expect.any(String)))
      expect.soft(await db.select().from(mapsTable).where(eq(mapsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.id))).toEqual([])
    })
  })
})

function createGamesController({ db, logger }: { db: Database; logger: Logger }): GamesController {
  return new GamesController({
    createTransaction: db.transaction.bind(db),
    gamesRepository: new GamesRepository({ db, logger }),
    gameSettingsRepository: new GameSettingsRepository({ db, logger }),
    gamePlayersRepository: new GamePlayersRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    logger,
  })
}

function createCoherentMap({ gameId }: { gameId: number }): NewMapModel {
  const orbitId = v4()
  const sectorId = v4()
  const sectorMovementNodeId = v4()
  const planetMovementNodeId = v4()
  const moonMovementNodeId = v4()

  return {
    gameId,
    movementNodes: [{ id: sectorMovementNodeId }, { id: planetMovementNodeId }, { id: moonMovementNodeId }],
    orbits: [{ id: orbitId, orbitNumber: 1 }],
    sectors: [
      {
        id: sectorId,
        orbitId,
        sectorNumber: 1,
        angleRange: Range.create({
          numericType: "float",
          maxBoundType: "exclusive",
          min: 0,
          max: 360,
        }),
        movementNodeId: sectorMovementNodeId,
      },
    ],
    bodies: [
      {
        id: v4(),
        sectorId,
        bodyNumber: 1,
        bodyType: BodyType.PLANET,
        name: "World",
        movementNodeId: planetMovementNodeId,
      },
      {
        id: v4(),
        sectorId,
        bodyNumber: 2,
        bodyType: BodyType.MOON,
        name: "Moon",
        movementNodeId: moonMovementNodeId,
      },
    ],
    movementEdges: [{ fromNodeId: sectorMovementNodeId, toNodeId: planetMovementNodeId, weight: 1 }],
  }
}

function createIncoherentMap({ gameId }: { gameId: number }): NewMapModel {
  const orbitId = v4()
  const sectorId = v4()
  const missingSectorId = v4()
  const sectorMovementNodeId = v4()
  const bodyMovementNodeId = v4()

  return {
    gameId,
    movementNodes: [{ id: sectorMovementNodeId }, { id: bodyMovementNodeId }],
    orbits: [{ id: orbitId, orbitNumber: 1 }],
    sectors: [
      {
        id: sectorId,
        orbitId,
        sectorNumber: 1,
        angleRange: Range.create({
          numericType: "float",
          maxBoundType: "exclusive",
          min: 0,
          max: 360,
        }),
        movementNodeId: sectorMovementNodeId,
      },
    ],
    bodies: [
      {
        id: v4(),
        sectorId: missingSectorId,
        bodyNumber: 1,
        bodyType: BodyType.PLANET,
        name: "Broken World",
        movementNodeId: bodyMovementNodeId,
      },
    ],
    movementEdges: [],
  }
}

function toStoredSector({ sector, gameId }: { sector: NewSectorModel; gameId: number }): typeof sectorsTable.$inferSelect {
  return {
    id: sector.id,
    gameId,
    orbitId: sector.orbitId,
    sectorNumber: sector.sectorNumber,
    angleNumericType: sector.angleRange.numericType,
    angleMaxBoundType: sector.angleRange.maxBoundType,
    startAngleDegrees: sector.angleRange.min,
    endAngleDegrees: sector.angleRange.max,
    movementNodeId: sector.movementNodeId,
  }
}
