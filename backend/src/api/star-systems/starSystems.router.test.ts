import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createPlayerRowInsertStub } from "#lib/db/players/PlayerRowInsert.stub.ts"
import { TrpcClient } from "#tests/TrpcClient.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { createGameRowInsertStub } from "#lib/db/games/GameRowInsert.stub.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { BodyType } from "#lib/star-systems/BodyType.ts"

describe("starSystems.router", () => {
  describe("getSystem", () => {
    it("should get a generated system for an authenticated player in the game", async () => {
      // Arrange
      const { api, authService, playersRepository } = await createApiStub()
      using trpcClient = new TrpcClient({ api })

      authService.player = extractSuccess(await playersRepository.create(createPlayerRowInsertStub()))
      const generationSettings = createStarSystemGenerationSettingsStub({
        planetDensity: { min: 1, max: 1 },
        nbPlanets: { min: 2, max: 2 },
        nbMoonsPerPlanet: { min: 1, max: 1 },
        nbAsteroidBelts: { min: 0, max: 0 },
        nbAsteroidsPerSector: { min: 0, max: 0 },
        seed: 1234,
      })

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "generated system game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: generationSettings,
        },
      })

      // Act
      const getStarSystemResponse = await trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })

      // Assert
      const bodies = getStarSystemResponse.starSystem.orbits.flatMap((orbit) => orbit.sectors).flatMap((sector) => sector.bodies)
      expect(getStarSystemResponse.starSystem).toMatchObject({
        gameId: createGameResult.newGame.id,
        orbits: [
          {
            number: 1,
            coordinates: "01",
          },
        ],
      })
      expect(bodies.filter((body) => body.type === BodyType.PLANET)).toHaveLength(2)
      expect(bodies.filter((body) => body.type === BodyType.MOON)).toHaveLength(2)
      expect(Object.keys(getStarSystemResponse.starSystem.movementEdges).length).toBeGreaterThan(0)
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

      const createGameResult = await trpcClient.client.games.create.mutate({
        newGame: {
          name: "private system game",
          nbSeats: 2,
          tickIntervalSeconds: 60,
          starSystemGenerationSettings: createStarSystemGenerationSettingsStub(),
        },
      })
      authService.player = outsider

      // Act & Assert
      await expect(trpcClient.client.starSystems.getByGameId.query({ gameId: createGameResult.newGame.id })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should return not found for an existing game with no Star System", async () => {
      // Arrange
      const { api, authService, playersRepository, gamesRepository } = await createApiStub()
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
