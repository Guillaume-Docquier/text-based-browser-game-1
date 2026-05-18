import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"
import { createGameRowInsertStub } from "#lib/db/games/GameRowInsert.stub.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { createNewGameDtoStub } from "#api/games/NewGameDto.stub.ts"

describe("starSystems.router", () => {
  describe("getSystem", () => {
    it("should get the full stored system for an authenticated player in the game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: createNewGameDtoStub({
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub({
            planetDensity: { min: 1, max: 1 },
            nbPlanets: { min: 1, max: 1 },
            nbMoonsPerPlanet: { min: 1, max: 1 },
            nbAsteroidBelts: { min: 0, max: 0 },
            nbAsteroidsPerSector: { min: 0, max: 0 },
          }),
        }),
      })

      // Act
      const getStarSystemResponse = await trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })

      // Assert
      const bodies = getStarSystemResponse.starSystem.orbits.flatMap((orbit) => orbit.sectors.flatMap((sector) => sector.bodies))
      expect(getStarSystemResponse.starSystem.gameId).toBe(createGameResult.newGame.id)
      expect(getStarSystemResponse.starSystem.orbits).toHaveLength(1)
      expect(getStarSystemResponse.starSystem.orbits[0]?.sectors).toHaveLength(2)
      expect(bodies.map((body) => body.type).toSorted()).toEqual([BodyType.MOON, BodyType.PLANET])
      expect(Object.values(getStarSystemResponse.starSystem.movementEdges).flat()).toEqual(
        expect.arrayContaining([expect.objectContaining({ weight: 1 })]),
      )
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
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      const creator = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Creator" })))
      const outsider = extractSuccess(await playersRepository.create(createPlayerRowInsertStub({ alias: "Outsider" })))
      authService.player = creator

      const createGameResult = await trpcClient.client.games.create.mutate({ newGame: createNewGameDtoStub() })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
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
