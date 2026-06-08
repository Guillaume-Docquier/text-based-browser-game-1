import { describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { v4 } from "uuid"
import { Assert, Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { AccountsRepository } from "#api/accounts/accounts.repository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "#lib/db/schema.ts"
import { type NewSectorModel, type NewStarSystemModel, StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { GamesController } from "#api/games/games.controller.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createCreateGameDtoStub } from "#api/games/CreateGameDto.stub.ts"
import type { Database } from "#lib/db/createDb.ts"
import { GameSettingsRepository } from "#lib/db/games/gameSettings.repository.ts"
import { GameStatesRepository } from "#lib/db/gameStates.repository.ts"
import { GameTicksRepository } from "#lib/db/gameTicks.repository.ts"
import { GamePlayerResourcesRepository } from "#lib/db/resources/gamePlayerResources.repository.ts"
import type { GameId } from "#api/games/GameId.ts"
import { GameLobbiesRepository } from "#api/game-lobbies/gameLobbies.repository.ts"

describe("starSystems.repository", () => {
  describe("create", () => {
    it("should create a Star System with bodies and movement edges", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new AccountsRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const account = extractSuccess(await playersRepository.createAccount(createNewAccountModelStub()))
      const game = extractSuccess(await gamesController.createGame(createCreateGameDtoStub({ createdByAccountId: account.id })))

      const system = createCoherentStarSystem({ gameId: game.createdGameId })
      const firstSector = system.sectors[0]
      Assert.isDefined(firstSector)

      // Act
      const createStarSystemResult = await starSystemsRepository.create(system)

      // Assert
      expect(createStarSystemResult).toEqual(Result.Success(true))
      expect
        .soft(await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, game.createdGameId)))
        .toEqual([{ createdAt: expect.any(Date), gameId: game.createdGameId }])
      expect
        .soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.createdGameId)))
        .toEqual([{ ...system.orbits[0], gameId: game.createdGameId }])
      expect
        .soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.createdGameId)))
        .toEqual([toStoredSector({ sector: firstSector, gameId: game.createdGameId })])
      expect
        .soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.createdGameId)))
        .toEqual(system.bodies.map((body) => ({ ...body, gameId: game.createdGameId })))
      expect
        .soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.createdGameId)))
        .toEqual(system.movementNodes.map((movementNode) => ({ ...movementNode, gameId: game.createdGameId })))
      expect
        .soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.createdGameId)))
        .toEqual([{ ...system.movementEdges[0], gameId: game.createdGameId }])
    })

    it("should fail one request when creating two star systems concurrently for the same game", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new AccountsRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const account = extractSuccess(await playersRepository.createAccount(createNewAccountModelStub()))
      const game = extractSuccess(await gamesController.createGame(createCreateGameDtoStub({ createdByAccountId: account.id })))

      const system1 = createCoherentStarSystem({ gameId: game.createdGameId })
      const system2 = createCoherentStarSystem({ gameId: game.createdGameId })

      // Act
      const createStarSystemResults = await Promise.all([starSystemsRepository.create(system1), starSystemsRepository.create(system2)])

      // Assert
      expect(createStarSystemResults).toEqual(expect.arrayContaining([Result.Success(true), Result.Failure(expect.any(String))]))
    })

    it("should rollback the full Star System when one child row is incoherent", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()

      const playersRepository = new AccountsRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })
      const gamesController = createGamesController({ db, logger })

      const account = extractSuccess(await playersRepository.createAccount(createNewAccountModelStub()))
      const game = extractSuccess(await gamesController.createGame(createCreateGameDtoStub({ createdByAccountId: account.id })))

      const system = createIncoherentStarSystem({ gameId: game.createdGameId })

      // Act
      const createStarSystemResult = await starSystemsRepository.create(system)

      // Assert
      expect(createStarSystemResult).toEqual(Result.Failure(expect.any(String)))
      expect.soft(await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, game.createdGameId))).toEqual([])
      expect.soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.createdGameId))).toEqual([])
      expect.soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.createdGameId))).toEqual([])
      expect.soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.createdGameId))).toEqual([])
      expect.soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.createdGameId))).toEqual([])
      expect.soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.createdGameId))).toEqual([])
    })
  })
})

function createGamesController({ db, logger }: { db: Database; logger: Logger }): GamesController {
  return new GamesController({
    createTransaction: db.transaction.bind(db),
    gamesRepository: new GamesRepository({ db, logger }),
    gameSettingsRepository: new GameSettingsRepository({ db, logger }),
    gameLobbiesRepository: new GameLobbiesRepository({ db, logger }),
    gameStatesRepository: new GameStatesRepository({ db, logger }),
    gameTicksRepository: new GameTicksRepository({ db, logger }),
    gamePlayerResourcesRepository: new GamePlayerResourcesRepository({ db, logger }),
    logger,
  })
}

function createCoherentStarSystem({ gameId }: { gameId: GameId }): NewStarSystemModel {
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

function createIncoherentStarSystem({ gameId }: { gameId: GameId }): NewStarSystemModel {
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

function toStoredSector({ sector, gameId }: { sector: NewSectorModel; gameId: GameId }): typeof sectorsTable.$inferSelect {
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
