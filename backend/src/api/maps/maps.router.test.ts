import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createNewPlayerModelStub } from "#lib/db/players/NewPlayerModel.stub.ts"
import { type NewMapModel, type MapsRepository } from "#lib/db/maps/maps.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { Range, Result } from "@guillaume-docquier/tools-ts"
import { BodyType } from "#lib/maps/BodyType.ts"
import { v4 } from "uuid"
import { createNewGameDtoStub } from "#api/games/NewGameDto.stub.ts"

describe("maps.router", () => {
  describe("getByGameId", () => {
    it("should get the full stored map for an authenticated player in the game", async () => {
      // Arrange
      const { api, authService, playersRepository, mapsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createNewPlayerModelStub()))

      const createGameResult = await trpcClient.client.games.create.mutate({ newGame: createNewGameDtoStub() })
      const map = await createStoredMap({ mapsRepository, gameId: createGameResult.newGame.id })

      // Act
      const getMapResponse = await trpcClient.client.maps.getByGameId.query({ gameId: createGameResult.newGame.id })

      // Assert
      expect(getMapResponse.map).toEqual<typeof getMapResponse.map>({
        gameId: createGameResult.newGame.id,
        orbits: [
          {
            id: expect.any(String),
            number: 1,
            coordinates: "01",
            sectors: [
              {
                id: expect.any(String),
                number: 1,
                coordinates: "01:01",
                angleRange: Range.create({
                  numericType: "float",
                  maxBoundType: "exclusive",
                  min: 0,
                  max: 180,
                }),
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
                angleRange: Range.create({
                  numericType: "float",
                  maxBoundType: "exclusive",
                  min: 180,
                  max: 360,
                }),
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
        ],
        movementEdges: {
          // Quite bad, if we have to do more we'll need to improve on this
          [map.sectors[0].movementNodeId]: [
            { fromNodeId: map.sectors[0].movementNodeId, toNodeId: map.bodies[0].movementNodeId, weight: 1 },
            { fromNodeId: map.sectors[0].movementNodeId, toNodeId: map.bodies[1].movementNodeId, weight: 1 },
            { fromNodeId: map.sectors[0].movementNodeId, toNodeId: map.sectors[1].movementNodeId, weight: 1 },
          ],
          [map.sectors[1].movementNodeId]: [
            { fromNodeId: map.sectors[1].movementNodeId, toNodeId: map.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: map.sectors[1].movementNodeId, toNodeId: map.bodies[2].movementNodeId, weight: 1 },
          ],
          [map.bodies[0].movementNodeId]: [
            { fromNodeId: map.bodies[0].movementNodeId, toNodeId: map.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: map.bodies[0].movementNodeId, toNodeId: map.bodies[1].movementNodeId, weight: 1 },
          ],
          [map.bodies[1].movementNodeId]: [
            { fromNodeId: map.bodies[1].movementNodeId, toNodeId: map.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: map.bodies[1].movementNodeId, toNodeId: map.bodies[0].movementNodeId, weight: 1 },
          ],
          [map.bodies[2].movementNodeId]: [
            { fromNodeId: map.bodies[2].movementNodeId, toNodeId: map.sectors[1].movementNodeId, weight: 1 },
          ],
        },
      })
    })

    it("should reject anonymous reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.maps.getByGameId.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should reject a player who is authenticated but not in the game", async () => {
      // Arrange
      const { api, authService, playersRepository, mapsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createNewPlayerModelStub({ alias: "Creator" })))
      const outsider = extractSuccess(await playersRepository.create(createNewPlayerModelStub({ alias: "Outsider" })))
      authService.player = creator

      const createGameResult = await trpcClient.client.games.create.mutate({ newGame: createNewGameDtoStub() })
      await createStoredMap({ mapsRepository, gameId: createGameResult.newGame.id })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.maps.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no Map", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createNewPlayerModelStub()))

      const createGameResult = await trpcClient.client.games.create.mutate({ newGame: createNewGameDtoStub() })

      // Act & Assert
      await expect(trpcClient.client.maps.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })
})

/**
 * @deprecated Should be handled by the game creation route when world generation is implemented
 */
async function createStoredMap({
  mapsRepository,
  gameId,
}: {
  mapsRepository: MapsRepository
  gameId: number
}): Promise<ReturnType<typeof createMapFixture>> {
  const map = createMapFixture({ gameId })
  const createMapResult = await mapsRepository.create(map)
  if (Result.isFailure(createMapResult)) {
    throw new Error(createMapResult.error)
  }

  return map
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- As const will help the tests verbosity
function createMapFixture({ gameId }: { gameId: number }) {
  const orbitId = v4()
  const sector1Id = v4()
  const sector2Id = v4()
  const sector1MovementNodeId = v4()
  const sector2MovementNodeId = v4()
  const planetMovementNodeId = v4()
  const moonMovementNodeId = v4()
  const asteroidMovementNodeId = v4()

  return {
    gameId,
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
        angleRange: Range.create({
          numericType: "float",
          maxBoundType: "exclusive",
          min: 0,
          max: 180,
        }),
        movementNodeId: sector1MovementNodeId,
      },
      {
        id: sector2Id,
        orbitId,
        sectorNumber: 2,
        angleRange: Range.create({
          numericType: "float",
          maxBoundType: "exclusive",
          min: 180,
          max: 360,
        }),
        movementNodeId: sector2MovementNodeId,
      },
    ],
    bodies: [
      {
        id: v4(),
        sectorId: sector1Id,
        bodyNumber: 1,
        bodyType: BodyType.PLANET,
        name: "World",
        movementNodeId: planetMovementNodeId,
      },
      {
        id: v4(),
        sectorId: sector1Id,
        bodyNumber: 2,
        bodyType: BodyType.MOON,
        name: "Moon",
        movementNodeId: moonMovementNodeId,
      },
      {
        id: v4(),
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
  } as const satisfies NewMapModel
}
