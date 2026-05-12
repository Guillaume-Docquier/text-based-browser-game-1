import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { type StarSystemWriteModel, StarSystemsRepository } from "#lib/db/starSystems.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createPlayer } from "#tests/createPlayer.ts"
import { Logger, Result } from "@guillaume-docquier/tools-ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"

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

      expect(getSystemResult.starSystem.movementGraph.edges[sector1.movementNodeId]).toEqual(
        expect.arrayContaining([
          { from: sector1.movementNodeId, to: planet.movementNodeId, weight: 1 },
          { from: sector1.movementNodeId, to: moon.movementNodeId, weight: 1 },
          { from: sector1.movementNodeId, to: sector2.movementNodeId, weight: 1 },
        ]),
      )
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

function createStarSystemFixture({ gameId }: { gameId: number }): StarSystemWriteModel {
  return {
    gameId,
    generationSettings: createStarSystemGenerationSettings(),
    orbits: [
      {
        number: 1,
        sectors: [
          {
            number: 1,
            movementNodeKey: "sector-1",
            bodies: [
              {
                number: 1,
                type: BodyType.PLANET,
                name: "World",
                movementNodeKey: "planet-1",
              },
              {
                number: 2,
                type: BodyType.MOON,
                name: "Moon",
                movementNodeKey: "moon-1",
              },
            ],
          },
          {
            number: 2,
            movementNodeKey: "sector-2",
            bodies: [
              {
                number: 1,
                type: BodyType.ASTEROID,
                name: "Rock",
                movementNodeKey: "asteroid-1",
              },
            ],
          },
        ],
      },
    ],
    movementEdges: [
      { from: "sector-1", to: "planet-1" },
      { from: "planet-1", to: "sector-1" },
      { from: "sector-1", to: "moon-1" },
      { from: "moon-1", to: "sector-1" },
      { from: "planet-1", to: "moon-1" },
      { from: "moon-1", to: "planet-1" },
      { from: "sector-1", to: "sector-2" },
      { from: "sector-2", to: "sector-1" },
      { from: "sector-2", to: "asteroid-1" },
      { from: "asteroid-1", to: "sector-2" },
    ],
  }
}

function createStarSystemGenerationSettings(): StarSystemWriteModel["generationSettings"] {
  return {
    planetDensity: { min: 0.5, max: 0.5 },
    nbPlanets: { min: 1, max: 1 },
    nbMoonsPerPlanet: { min: 1, max: 1 },
    nbAsteroidBelts: { min: 0, max: 0 },
    nbAsteroidsPerSector: { min: 1, max: 1 },
    seed: 1234,
  }
}
