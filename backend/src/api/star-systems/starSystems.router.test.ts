import { Range, Result } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createCreateLobbyDtoStub } from "#api/lobbies/CreateLobbyDto.stub.ts"
import type { GameId } from "#api/shared/GameId.ts"
import { type NewStarSystemModel, type StarSystemsRepository } from "#api/star-systems/starSystems.repository.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"

describe("starSystems.router", () => {
  describe("getSystem", () => {
    it("should get the full stored system for an authenticated player in the game", async () => {
      // Arrange
      const { api, authService, accountsRepository, starSystemsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate(createCreateLobbyDtoStub())
      const starSystem = await createStoredStarSystem({ starSystemsRepository, gameId: createdGameId })

      // Act
      const getStarSystemResponse = await trpcClient.client.starSystems.getByGameId.query({
        gameId: createdGameId,
      })

      // Assert
      expect(getStarSystemResponse.starSystem).toEqual<typeof getStarSystemResponse.starSystem>({
        gameId: createdGameId,
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
      const { api, authService, accountsRepository, starSystemsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Creator" })))
      const outsider = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub({ alias: "Outsider" })))
      authService.account = creator

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate(createCreateLobbyDtoStub())
      await createStoredStarSystem({ starSystemsRepository, gameId: createdGameId })
      authService.account = outsider

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no Star System", async () => {
      // Arrange
      const { api, authService, accountsRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))

      const { createdGameId } = await trpcClient.client.lobbies.create.mutate(createCreateLobbyDtoStub())

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createdGameId })).rejects.toMatchObject({
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
  gameId: GameId
}): Promise<ReturnType<typeof createStarSystemFixture>> {
  const starSystem = createStarSystemFixture({ gameId })
  const createSystemResult = await starSystemsRepository.create(starSystem)
  if (Result.isFailure(createSystemResult)) {
    throw new Error(createSystemResult.error)
  }

  return starSystem
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- As const will help the tests verbosity
function createStarSystemFixture({ gameId }: { gameId: GameId }) {
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
  } as const satisfies NewStarSystemModel
}
