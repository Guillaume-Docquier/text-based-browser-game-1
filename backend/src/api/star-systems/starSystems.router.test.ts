import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { type NewStarSystem, StarSystemsRepository } from "#lib/db/starSystems.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createPlayer } from "#tests/createPlayer.ts"
import { Logger, Result } from "@guillaume-docquier/tools-ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { randomUUID } from "node:crypto"

describe("starSystems.router", () => {
  describe("getSystem", () => {
    it("should get the full stored system for an authenticated player in the game", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService, logger })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "mapped game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await createStoredStarSystem({ db, logger, gameId: createGameResult.newGame.id })

      // Act
      const getSystemResult = await trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getSystemResult.starSystem.gameId).toBe(createGameResult.newGame.id)
      expect(getSystemResult.starSystem.orbits).toEqual([
        {
          id: expect.any(String),
          number: 1,
          coordinates: "01",
          sectors: [
            {
              id: expect.any(String),
              number: 1,
              coordinates: "01:01",
              movementNodeId: expect.any(String),
              bodies: [
                {
                  id: expect.any(String),
                  number: 1,
                  coordinates: "01:01:01",
                  name: "World",
                  type: BodyType.PLANET,
                  movementNodeId: expect.any(String),
                },
                {
                  id: expect.any(String),
                  number: 2,
                  coordinates: "01:01:02",
                  name: "Moon",
                  type: BodyType.MOON,
                  movementNodeId: expect.any(String),
                },
              ],
            },
            {
              id: expect.any(String),
              number: 2,
              coordinates: "01:02",
              movementNodeId: expect.any(String),
              bodies: [
                {
                  id: expect.any(String),
                  number: 1,
                  coordinates: "01:02:01",
                  name: "Rock",
                  type: BodyType.ASTEROID,
                  movementNodeId: expect.any(String),
                },
              ],
            },
          ],
        },
      ])

      const sector1 = getSystemResult.starSystem.orbits[0]?.sectors[0]
      const sector2 = getSystemResult.starSystem.orbits[0]?.sectors[1]
      const planet = sector1?.bodies[0]
      const moon = sector1?.bodies[1]
      expect(sector1).toBeDefined()
      expect(sector2).toBeDefined()
      expect(planet).toBeDefined()
      expect(moon).toBeDefined()
      if (sector1 === undefined || sector2 === undefined || planet === undefined || moon === undefined) {
        throw new Error("Expected Star System fixture to contain sector and body data.")
      }

      const edges = getSystemResult.starSystem.movementEdges[sector1.movementNodeId]
      expect(edges).toEqual<typeof edges>([
        { fromNodeId: sector1.movementNodeId, toNodeId: planet.movementNodeId, weight: 1 },
        { fromNodeId: sector1.movementNodeId, toNodeId: moon.movementNodeId, weight: 1 },
        { fromNodeId: sector1.movementNodeId, toNodeId: sector2.movementNodeId, weight: 1 },
      ])
    })

    it("should reject anonymous reads", async () => {
      // Arrange
      const api = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should reject a player who is authenticated but not in the game", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const creator = await createPlayer(db, createPlayerRowInsertStub({ alias: "Creator" }))
      const outsider = await createPlayer(
        db,
        createPlayerRowInsertStub({ clerk_id: "clerk_player-2", email: "player-2@example.com", alias: "Outsider" }),
      )
      const authService = new AuthServiceMock({ player: creator })
      const api = await createApiStub({ db, authService, logger })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "private mapped game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await createStoredStarSystem({ db, logger, gameId: createGameResult.newGame.id })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no Star System", async () => {
      // Arrange
      const db = await createDbMock()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "unmapped game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })
})

async function createStoredStarSystem({
  db,
  logger,
  gameId,
}: {
  db: ConstructorParameters<typeof StarSystemsRepository>[0]["db"]
  logger: Logger
  gameId: number
}): Promise<void> {
  const starSystemsRepository = new StarSystemsRepository({ db, logger })
  const createSystemResult = await starSystemsRepository.create(createStarSystemFixture({ gameId }))
  if (Result.isFailure(createSystemResult)) {
    throw new Error(createSystemResult.error)
  }
}

function createStarSystemFixture({ gameId }: { gameId: number }): NewStarSystem {
  const orbitId = randomUUID()
  const sector1Id = randomUUID()
  const sector2Id = randomUUID()
  const sector1MovementNodeId = randomUUID()
  const sector2MovementNodeId = randomUUID()
  const planetMovementNodeId = randomUUID()
  const moonMovementNodeId = randomUUID()
  const asteroidMovementNodeId = randomUUID()

  return {
    gameId,
    generationSettings: createStarSystemGenerationSettings(),
    movementNodes: [
      { id: sector1MovementNodeId },
      { id: sector2MovementNodeId },
      { id: planetMovementNodeId },
      { id: moonMovementNodeId },
      { id: asteroidMovementNodeId },
    ],
    orbits: [
      {
        id: orbitId,
        orbitNumber: 1,
      },
    ],
    sectors: [
      {
        id: sector1Id,
        orbitId,
        sectorNumber: 1,
        movementNodeId: sector1MovementNodeId,
      },
      {
        id: sector2Id,
        orbitId,
        sectorNumber: 2,
        movementNodeId: sector2MovementNodeId,
      },
    ],
    bodies: [
      {
        id: randomUUID(),
        sectorId: sector1Id,
        bodyNumber: 1,
        bodyType: BodyType.PLANET,
        name: "World",
        movementNodeId: planetMovementNodeId,
      },
      {
        id: randomUUID(),
        sectorId: sector1Id,
        bodyNumber: 2,
        bodyType: BodyType.MOON,
        name: "Moon",
        movementNodeId: moonMovementNodeId,
      },
      {
        id: randomUUID(),
        sectorId: sector2Id,
        bodyNumber: 1,
        bodyType: BodyType.ASTEROID,
        name: "Rock",
        movementNodeId: asteroidMovementNodeId,
      },
    ],
    movementEdges: [
      { fromNodeId: sector1MovementNodeId, toNodeId: planetMovementNodeId, weight: 1 },
      { fromNodeId: planetMovementNodeId, toNodeId: sector1MovementNodeId, weight: 1 },
      { fromNodeId: sector1MovementNodeId, toNodeId: moonMovementNodeId, weight: 1 },
      { fromNodeId: moonMovementNodeId, toNodeId: sector1MovementNodeId, weight: 1 },
      { fromNodeId: planetMovementNodeId, toNodeId: moonMovementNodeId, weight: 1 },
      { fromNodeId: moonMovementNodeId, toNodeId: planetMovementNodeId, weight: 1 },
      { fromNodeId: sector1MovementNodeId, toNodeId: sector2MovementNodeId, weight: 1 },
      { fromNodeId: sector2MovementNodeId, toNodeId: sector1MovementNodeId, weight: 1 },
      { fromNodeId: sector2MovementNodeId, toNodeId: asteroidMovementNodeId, weight: 1 },
      { fromNodeId: asteroidMovementNodeId, toNodeId: sector2MovementNodeId, weight: 1 },
    ],
  }
}

function createStarSystemGenerationSettings(): NewStarSystem["generationSettings"] {
  return {
    planetDensity: { min: 0.5, max: 0.5 },
    nbPlanets: { min: 1, max: 1 },
    nbMoonsPerPlanet: { min: 1, max: 1 },
    nbAsteroidBelts: { min: 0, max: 0 },
    nbAsteroidsPerSector: { min: 1, max: 1 },
    seed: 1234,
  }
}
