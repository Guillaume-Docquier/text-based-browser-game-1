import { describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { Logger, Result } from "@guillaume-docquier/tools-ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { PlayersRepository } from "#lib/db/players/players.repository.ts"
import { bodiesTable, movementEdgesTable, movementNodesTable, orbitsTable, sectorsTable, starSystemsTable } from "#lib/db/schema.ts"
import { type NewStarSystem, StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { createGameRowInsertStub } from "#lib/db/games/GameRowInsert.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"

describe("starSystems.repository", () => {
  describe("create", () => {
    it("should create a Star System with bodies and movement edges", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const logger = Logger.get()

      const gamesRepository = new GamesRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: player.id })))

      const system = createCoherentStarSystem({ gameId: game.id })

      // Act
      const createStarSystemResult = await starSystemsRepository.create(system)

      // Assert
      expect(createStarSystemResult).toEqual(Result.Success(true))
      expect
        .soft(await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, game.id)))
        .toEqual([{ createdAt: expect.any(Date), gameId: game.id, generationSettings: system.generationSettings }])
      expect
        .soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.id)))
        .toEqual([{ ...system.orbits[0], gameId: game.id }])
      expect
        .soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.id)))
        .toEqual([{ ...system.sectors[0], gameId: game.id }])
      expect
        .soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.id)))
        .toEqual(system.bodies.map((body) => ({ ...body, gameId: game.id })))
      expect
        .soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.id)))
        .toEqual(system.movementNodes.map((movementNode) => ({ ...movementNode, gameId: game.id })))
      expect
        .soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.id)))
        .toEqual([{ ...system.movementEdges[0], gameId: game.id }])
    })

    it("should fail one request when creating two star systems concurrently for the same game", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const logger = Logger.get()

      const gamesRepository = new GamesRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: player.id })))

      const system1 = createCoherentStarSystem({ gameId: game.id })
      const system2 = createCoherentStarSystem({ gameId: game.id })

      // Act
      const createStarSystemResults = await Promise.all([starSystemsRepository.create(system1), starSystemsRepository.create(system2)])

      // Assert
      expect(createStarSystemResults).toEqual(expect.arrayContaining([Result.Success(true), Result.Failure(expect.any(String))]))
    })

    it("should rollback the full Star System when one child row is incoherent", async () => {
      // Arrange
      const db = await createDbMock()
      const playersRepository = new PlayersRepository({ db, logger: Logger.get() })
      const logger = Logger.get()

      const gamesRepository = new GamesRepository({ db, logger })
      const starSystemsRepository = new StarSystemsRepository({ db, logger })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: player.id })))

      const system = createIncoherentStarSystem({ gameId: game.id })

      // Act
      const createStarSystemResult = await starSystemsRepository.create(system)

      // Assert
      expect(createStarSystemResult).toEqual(Result.Failure(expect.any(String)))
      expect.soft(await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.id))).toEqual([])
    })
  })
})

function createCoherentStarSystem({ gameId }: { gameId: number }): NewStarSystem {
  const orbitId = randomUUID()
  const sectorId = randomUUID()
  const sectorMovementNodeId = randomUUID()
  const planetMovementNodeId = randomUUID()
  const moonMovementNodeId = randomUUID()

  return {
    gameId,
    generationSettings: createStarSystemGenerationSettingsStub(),
    movementNodes: [{ id: sectorMovementNodeId }, { id: planetMovementNodeId }, { id: moonMovementNodeId }],
    orbits: [{ id: orbitId, orbitNumber: 1 }],
    sectors: [
      {
        id: sectorId,
        orbitId,
        sectorNumber: 1,
        movementNodeId: sectorMovementNodeId,
      },
    ],
    bodies: [
      {
        id: randomUUID(),
        sectorId,
        bodyNumber: 1,
        bodyType: BodyType.PLANET,
        name: "World",
        movementNodeId: planetMovementNodeId,
      },
      {
        id: randomUUID(),
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

function createIncoherentStarSystem({ gameId }: { gameId: number }): NewStarSystem {
  const orbitId = randomUUID()
  const sectorId = randomUUID()
  const missingSectorId = randomUUID()
  const sectorMovementNodeId = randomUUID()
  const bodyMovementNodeId = randomUUID()

  return {
    gameId,
    generationSettings: createStarSystemGenerationSettingsStub(),
    movementNodes: [{ id: sectorMovementNodeId }, { id: bodyMovementNodeId }],
    orbits: [{ id: orbitId, orbitNumber: 1 }],
    sectors: [
      {
        id: sectorId,
        orbitId,
        sectorNumber: 1,
        movementNodeId: sectorMovementNodeId,
      },
    ],
    bodies: [
      {
        id: randomUUID(),
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
