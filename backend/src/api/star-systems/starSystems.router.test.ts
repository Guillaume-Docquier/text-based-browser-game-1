import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { type NewStarSystem, type StarSystemsRepository } from "#lib/db/star-systems/starSystems.repository.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { Result } from "@guillaume-docquier/tools-ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { randomUUID } from "node:crypto"
import { createGameRowInsertStub } from "#lib/db/games/GameRowInsert.stub.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

describe("starSystems.router", () => {
  describe("getSystem", () => {
    it("should get the full stored system for an authenticated player in the game", async () => {
      // Arrange
      const { api, authService, gamesRepository, playersRepository, starSystemsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: player.id })))
      const starSystem = await createStoredStarSystem({ starSystemsRepository, gameId: game.id })

      // Act
      const getStarSystemResponse = await trpcClient.client.starSystems.getByGameId.query({ gameId: game.id })

      // Assert
      expect(getStarSystemResponse.starSystem).toEqual<typeof getStarSystemResponse.starSystem>({
        gameId: game.id,
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
        ],
        movementEdges: {
          // Quite bad, if we have to do more we'll need to improve on this
          [starSystem.sectors[0].movementNodeId]: [
            { fromNodeId: starSystem.sectors[0].movementNodeId, toNodeId: starSystem.bodies[0].movementNodeId, weight: 1 },
            { fromNodeId: starSystem.sectors[0].movementNodeId, toNodeId: starSystem.bodies[1].movementNodeId, weight: 1 },
            { fromNodeId: starSystem.sectors[0].movementNodeId, toNodeId: starSystem.sectors[1].movementNodeId, weight: 1 },
          ],
          [starSystem.sectors[1].movementNodeId]: [
            { fromNodeId: starSystem.sectors[1].movementNodeId, toNodeId: starSystem.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: starSystem.sectors[1].movementNodeId, toNodeId: starSystem.bodies[2].movementNodeId, weight: 1 },
          ],
          [starSystem.bodies[0].movementNodeId]: [
            { fromNodeId: starSystem.bodies[0].movementNodeId, toNodeId: starSystem.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: starSystem.bodies[0].movementNodeId, toNodeId: starSystem.bodies[1].movementNodeId, weight: 1 },
          ],
          [starSystem.bodies[1].movementNodeId]: [
            { fromNodeId: starSystem.bodies[1].movementNodeId, toNodeId: starSystem.sectors[0].movementNodeId, weight: 1 },
            { fromNodeId: starSystem.bodies[1].movementNodeId, toNodeId: starSystem.bodies[0].movementNodeId, weight: 1 },
          ],
          [starSystem.bodies[2].movementNodeId]: [
            { fromNodeId: starSystem.bodies[2].movementNodeId, toNodeId: starSystem.sectors[1].movementNodeId, weight: 1 },
          ],
        },
      })
    })

    it("should reject anonymous reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })

    it("should reject a player who is authenticated but not in the game", async () => {
      // Arrange
      const { api, authService, gamesRepository, playersRepository, starSystemsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const outsider = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Outsider" })))
      authService.player = creator

      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: creator.id })))
      await createStoredStarSystem({ starSystemsRepository, gameId: game.id })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: game.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no Star System", async () => {
      // Arrange
      const { api, authService, gamesRepository, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      authService.player = player

      const game = extractSuccess(await gamesRepository.create(createGameRowInsertStub({ createdByPlayerId: player.id })))

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: game.id })).rejects.toMatchObject({
        data: { code: "NOT_FOUND" },
      })
    })
  })
})

/**
 * @deprecated Should be handled by the game creation route when world generation is implemented
 */
async function createStoredStarSystem({
  starSystemsRepository,
  gameId,
}: {
  starSystemsRepository: StarSystemsRepository
  gameId: number
}): Promise<ReturnType<typeof createStarSystemFixture>> {
  const starSystem = createStarSystemFixture({ gameId })
  const createSystemResult = await starSystemsRepository.create(starSystem)
  if (Result.isFailure(createSystemResult)) {
    throw new Error(createSystemResult.error)
  }

  return starSystem
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- As const will help the tests verbosity
function createStarSystemFixture({ gameId }: { gameId: number }) {
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
    generationSettings: createStarSystemGenerationSettingsStub(),
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
  } as const satisfies NewStarSystem
}
