import { describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { Result, Logger, Assert } from "@guillaume-docquier/tools-ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import {
  bodiesTable,
  gamesTable,
  movementEdgesTable,
  movementNodesTable,
  orbitsTable,
  sectorsTable,
  starSystemsTable,
} from "#lib/db/schema.ts"
import { type NewStarSystem, StarSystemsRepository } from "#lib/db/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createPlayer } from "#tests/createPlayer.ts"

describe("starSystems.repository", () => {
  describe("create", () => {
    it("should rollback the full Star System when one child row is incoherent", async () => {
      // Arrange
      const db = await createDbMock()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const game = (
        await db
          .insert(gamesTable)
          .values({
            name: "incoherent star system game",
            createdByPlayerId: player.id,
            nbSeats: 2,
            tickIntervalSeconds: 60,
          })
          .returning()
      )[0]
      Assert.isDefined(game)

      const repository = new StarSystemsRepository({ db, logger: Logger.get() })
      const system = createIncoherentStarSystem({ gameId: game.id })

      // Act
      const createStarSystemResult = await repository.create(system)

      // Assert
      expect(createStarSystemResult).toBe(Result.Failure(expect.any(String)))
      expect.soft(await db.select().from(starSystemsTable).where(eq(starSystemsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(orbitsTable).where(eq(orbitsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(sectorsTable).where(eq(sectorsTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(bodiesTable).where(eq(bodiesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementNodesTable).where(eq(movementNodesTable.gameId, game.id))).toEqual([])
      expect.soft(await db.select().from(movementEdgesTable).where(eq(movementEdgesTable.gameId, game.id))).toEqual([])
    })
  })
})

function createIncoherentStarSystem({ gameId }: { gameId: number }): NewStarSystem {
  const orbitId = randomUUID()
  const sectorId = randomUUID()
  const missingSectorId = randomUUID()
  const sectorMovementNodeId = randomUUID()
  const bodyMovementNodeId = randomUUID()

  return {
    gameId,
    generationSettings: {
      planetDensity: { min: 0.5, max: 0.5 },
      nbPlanets: { min: 1, max: 1 },
      nbMoonsPerPlanet: { min: 0, max: 0 },
      nbAsteroidBelts: { min: 0, max: 0 },
      nbAsteroidsPerSector: { min: 0, max: 0 },
      seed: 1234,
    },
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
