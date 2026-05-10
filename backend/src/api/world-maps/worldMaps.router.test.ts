import { describe, expect, it } from "vitest"
import { AuthServiceMock } from "#api/auth/auth.service.mock.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { createPlayerRowInsertStub } from "#lib/db/playerRowInsert.stub.ts"
import { BodyType } from "#lib/db/schema.ts"
import { type StarSystemWriteModel, WorldMapsRepository } from "#lib/db/worldMaps.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { createPlayer } from "#tests/createPlayer.ts"
import { Logger, Result } from "@guillaume-docquier/tools-ts"

describe("worldMaps.router", () => {
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
      await createStoredWorldMap({ db, logger, gameId: createGameResult.newGame.id })

      // Act
      const getSystemResult = await trpcClient.client.worldMaps.getSystem.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getSystemResult.system.gameId).toBe(createGameResult.newGame.id)
      expect(getSystemResult.system.generationSettings).toEqual(createMapGenerationSettings())
      expect(getSystemResult.system.orbits).toEqual([
        {
          id: expect.any(Number),
          number: 1,
          coordinates: "01",
          sectors: [
            {
              id: expect.any(Number),
              number: 1,
              coordinates: "01:01",
              movementNodeId: expect.any(Number),
              bodies: [
                {
                  id: expect.any(Number),
                  number: 1,
                  coordinates: "01:01:01",
                  name: "World",
                  type: BodyType.PLANET,
                  movementNodeId: expect.any(Number),
                },
                {
                  id: expect.any(Number),
                  number: 2,
                  coordinates: "01:01:02",
                  name: "Moon",
                  type: BodyType.MOON,
                  movementNodeId: expect.any(Number),
                },
              ],
            },
            {
              id: expect.any(Number),
              number: 2,
              coordinates: "01:02",
              movementNodeId: expect.any(Number),
              bodies: [
                {
                  id: expect.any(Number),
                  number: 1,
                  coordinates: "01:02:01",
                  name: "Rock",
                  type: BodyType.ASTEROID,
                  movementNodeId: expect.any(Number),
                },
              ],
            },
          ],
        },
      ])

      const sector1 = getSystemResult.system.orbits[0]?.sectors[0]
      const sector2 = getSystemResult.system.orbits[0]?.sectors[1]
      const planet = sector1?.bodies[0]
      const moon = sector1?.bodies[1]
      expect(sector1).toBeDefined()
      expect(sector2).toBeDefined()
      expect(planet).toBeDefined()
      expect(moon).toBeDefined()
      if (sector1 === undefined || sector2 === undefined || planet === undefined || moon === undefined) {
        throw new Error("Expected world map fixture to contain sector and body data.")
      }

      expect(getSystemResult.system.movementGraph.edges[sector1.movementNodeId.toString()]).toEqual(
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
      await expect(trpcClient.client.worldMaps.getSystem.query({ gameId: 1 })).rejects.toMatchObject({
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
      await createStoredWorldMap({ db, logger, gameId: createGameResult.newGame.id })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.worldMaps.getSystem.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no map", async () => {
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
      await expect(trpcClient.client.worldMaps.getSystem.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
  })

  describe("getSector", () => {
    it("should get a sector, its bodies, and local movement data", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService, logger })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "sector game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await createStoredWorldMap({ db, logger, gameId: createGameResult.newGame.id })

      // Act
      const getSectorResult = await trpcClient.client.worldMaps.getSector.query({
        gameId: createGameResult.newGame.id,
        coordinate: "01:01",
      })

      // Assert
      expect(getSectorResult.sector).toMatchObject({
        id: expect.any(Number),
        number: 1,
        coordinates: "01:01",
        movementNodeId: expect.any(Number),
        bodies: [
          {
            id: expect.any(Number),
            number: 1,
            coordinates: "01:01:01",
            name: "World",
            type: BodyType.PLANET,
            movementNodeId: expect.any(Number),
          },
          {
            id: expect.any(Number),
            number: 2,
            coordinates: "01:01:02",
            name: "Moon",
            type: BodyType.MOON,
            movementNodeId: expect.any(Number),
          },
        ],
      })
      expect(Object.keys(getSectorResult.sector.movementGraph.edges)).toContain(getSectorResult.sector.movementNodeId.toString())
    })

    it("should reject invalid coordinate strings at the router boundary", async () => {
      // Arrange
      const db = await createDbMock()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService })
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(
        trpcClient.client.worldMaps.getSector.query({
          gameId: 1,
          coordinate: "1:1",
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
  })

  describe("getBody", () => {
    it("should get a body, its coordinate context, and local movement data", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const player = await createPlayer(db, createPlayerRowInsertStub())
      const authService = new AuthServiceMock({ player })
      const api = await createApiStub({ db, authService, logger })
      using trpcClient = new TrpcClient({ api })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "body game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
        },
      })
      await createStoredWorldMap({ db, logger, gameId: createGameResult.newGame.id })

      // Act
      const getBodyResult = await trpcClient.client.worldMaps.getBody.query({
        gameId: createGameResult.newGame.id,
        coordinate: "01:01:01",
      })

      // Assert
      expect(getBodyResult.body).toMatchObject({
        id: expect.any(Number),
        number: 1,
        coordinates: "01:01:01",
        name: "World",
        type: BodyType.PLANET,
        movementNodeId: expect.any(Number),
        orbitId: expect.any(Number),
        orbitNumber: 1,
        orbitCoordinates: "01",
        sectorId: expect.any(Number),
        sectorNumber: 1,
        sectorCoordinates: "01:01",
      })
      expect(Object.keys(getBodyResult.body.movementGraph.edges)).toEqual([getBodyResult.body.movementNodeId.toString()])
    })
  })
})

async function createStoredWorldMap({
  db,
  logger,
  gameId,
}: {
  db: ConstructorParameters<typeof WorldMapsRepository>[0]["db"]
  logger: Logger
  gameId: number
}): Promise<void> {
  const worldMapsRepository = new WorldMapsRepository({ db, logger })
  const createSystemResult = await worldMapsRepository.createSystem(createWorldMapSystemFixture({ gameId }))
  if (Result.isFailure(createSystemResult)) {
    throw new Error(createSystemResult.error)
  }
}

function createWorldMapSystemFixture({ gameId }: { gameId: number }): StarSystemWriteModel {
  return {
    gameId,
    generationSettings: createMapGenerationSettings(),
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

function createMapGenerationSettings(): StarSystemWriteModel["generationSettings"] {
  return {
    planetDensityOfSystem: { min: 0.5, max: 0.5 },
    nbPlanets: { min: 1, max: 1 },
    nbMoonsPerPlanet: { min: 1, max: 1 },
    nbAsteroidBelts: { min: 0, max: 0 },
    nbAsteroidsPerSector: { min: 1, max: 1 },
    seed: 1234,
  }
}
