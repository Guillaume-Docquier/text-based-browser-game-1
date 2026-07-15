import { Assert, Datetime, Range, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { PlayerColor } from "#lib/db/PlayerColor.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { createResourceUpdateModelStub } from "#tests/resources/ResourceUpdateModel.stub.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    using apiServer = new ApiServer(await createApiStub())
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayer.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.getCurrentAction.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(
      nonPlayer.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        action: { actionType: GamePlayerActionType.MAKE_MORE_MONEY },
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({ nextTickAt: expect.any(String) }) // trpc serializes the date to string
      expect(new Date(startGameResult.nextTickAt).toString()).not.toBe("Invalid Date")
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const joiner = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await joiner.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(joiner.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject starting a game that has already started", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(creator.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should start two games with identical deterministic Star Systems", async () => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createGameConfigurationDtoStub({
        starSystemGenerationSettings: createStarSystemGenerationSettingsStub({ seed: 42 }),
      })
      const firstGame = await player.client.lobbies.create.mutate({ configuration: gameConfiguration })
      const secondGame = await player.client.lobbies.create.mutate({ configuration: gameConfiguration })

      // Act
      await player.client.gameplay.startGame.mutate({ gameId: firstGame.createdGameId })
      await player.client.gameplay.startGame.mutate({ gameId: secondGame.createdGameId })

      // Assert
      const game1View = await player.client.gameplay.getPlayerView.query({ gameId: firstGame.createdGameId })
      const game2View = await player.client.gameplay.getPlayerView.query({ gameId: secondGame.createdGameId })
      expect(game1View.starSystem).toEqual(game2View.starSystem)
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.startGame.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createGameConfigurationDtoStub({
        starSystemGenerationSettings: createStarSystemGenerationSettingsStub({
          nbPlanets: Range.integer({ min: 1, max: 1 }),
          planetDensity: Range.float({ min: 0.99, max: 1 }),
          nbMoonsPerPlanet: Range.integer({ min: 1, max: 1 }),
          nbAsteroidBelts: Range.integer({ min: 1, max: 1 }),
          nbAsteroidsPerSector: Range.integer({ min: 1, max: 1 }),
          seed: 42,
        }),
      })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: gameConfiguration })

      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const getByIdResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      // This is basically a snapshot test since we've tested the star systems extensively already in unit tests
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameId: createdGameId,
        player: { id: player.account.id, color: PlayerColor.WHITE },
        opponents: {},
        tick: 0,
        nextTickAt: Datetime.increment({
          date: clock.now(),
          time: Time.create(gameConfiguration.tickIntervalSeconds, UnitOfTime.SECONDS),
        }).toISOString(),
        starSystem: {
          orbits: [
            {
              coordinates: "01",
              id: "00000000-0000-7000-8000-0280af9c0078",
              number: 1,
              sectors: [
                {
                  angleRange: Range.float({ min: 0, max: 180 }),
                  bodies: [
                    {
                      coordinates: "01:01:01",
                      id: "00000000-0000-7000-8000-38544e258144",
                      movementNodeId: "00000000-0000-7000-8000-3e8019d20e5e",
                      name: "Asteroid 01",
                      number: 1,
                      type: BodyType.ASTEROID,
                    },
                  ],
                  coordinates: "01:01",
                  id: "00000000-0000-7000-8000-0a34484b13a8",
                  movementNodeId: "00000000-0000-7000-8000-0f9ce613b8ef",
                  number: 1,
                },
                {
                  angleRange: Range.float({ min: 180, max: 360 }),
                  bodies: [
                    {
                      coordinates: "01:02:01",
                      id: "00000000-0000-7000-8000-422d13180f43",
                      movementNodeId: "00000000-0000-7000-8000-44f1f34484dc",
                      name: "Asteroid 01",
                      number: 1,
                      type: BodyType.ASTEROID,
                    },
                  ],
                  coordinates: "01:02",
                  id: "00000000-0000-7000-8000-10569852ba4b",
                  movementNodeId: "00000000-0000-7000-8000-15e71779d221",
                  number: 2,
                },
              ],
            },
            {
              coordinates: "02",
              id: "00000000-0000-7000-8000-04d77ccf5173",
              number: 2,
              sectors: [
                {
                  angleRange: Range.float({ min: 0, max: 90 }),
                  bodies: [
                    {
                      coordinates: "02:01:01",
                      id: "00000000-0000-7000-8000-4ba1aadd63e0",
                      movementNodeId: "00000000-0000-7000-8000-4df67c46a1c5",
                      name: "Planet 01",
                      number: 1,
                      type: BodyType.PLANET,
                    },
                    {
                      coordinates: "02:01:02",
                      id: "00000000-0000-7000-8000-506b719db784",
                      movementNodeId: "00000000-0000-7000-8000-55b345dba0e8",
                      name: "Moon 02",
                      number: 2,
                      type: BodyType.MOON,
                    },
                  ],
                  coordinates: "02:01",
                  id: "00000000-0000-7000-8000-18e353ca6421",
                  movementNodeId: "00000000-0000-7000-8000-1f0cb4b54a46",
                  number: 1,
                },
                {
                  angleRange: Range.float({ min: 90, max: 180 }),
                  bodies: [],
                  coordinates: "02:02",
                  id: "00000000-0000-7000-8000-216f6baf6656",
                  movementNodeId: "00000000-0000-7000-8000-27382bb1501f",
                  number: 2,
                },
                {
                  angleRange: Range.float({ min: 180, max: 270 }),
                  bodies: [],
                  coordinates: "02:03",
                  id: "00000000-0000-7000-8000-2bde86d7e473",
                  movementNodeId: "00000000-0000-7000-8000-2e0d112b81ad",
                  number: 3,
                },
                {
                  angleRange: Range.float({ min: 270, max: 360 }),
                  bodies: [],
                  coordinates: "02:04",
                  id: "00000000-0000-7000-8000-3259f0a054d8",
                  movementNodeId: "00000000-0000-7000-8000-3545230c4a70",
                  number: 4,
                },
              ],
            },
          ],
          movementEdges: {
            "00000000-0000-7000-8000-0f9ce613b8ef": [
              { fromNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", toNodeId: "00000000-0000-7000-8000-15e71779d221", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", toNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", toNodeId: "00000000-0000-7000-8000-27382bb1501f", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", toNodeId: "00000000-0000-7000-8000-3e8019d20e5e", weight: 1 },
            ],
            "00000000-0000-7000-8000-15e71779d221": [
              { fromNodeId: "00000000-0000-7000-8000-15e71779d221", toNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-15e71779d221", toNodeId: "00000000-0000-7000-8000-2e0d112b81ad", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-15e71779d221", toNodeId: "00000000-0000-7000-8000-3545230c4a70", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-15e71779d221", toNodeId: "00000000-0000-7000-8000-44f1f34484dc", weight: 1 },
            ],
            "00000000-0000-7000-8000-1f0cb4b54a46": [
              { fromNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", toNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", toNodeId: "00000000-0000-7000-8000-27382bb1501f", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", toNodeId: "00000000-0000-7000-8000-3545230c4a70", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", toNodeId: "00000000-0000-7000-8000-4df67c46a1c5", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", toNodeId: "00000000-0000-7000-8000-55b345dba0e8", weight: 1 },
            ],
            "00000000-0000-7000-8000-27382bb1501f": [
              { fromNodeId: "00000000-0000-7000-8000-27382bb1501f", toNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-27382bb1501f", toNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-27382bb1501f", toNodeId: "00000000-0000-7000-8000-2e0d112b81ad", weight: 1 },
            ],
            "00000000-0000-7000-8000-2e0d112b81ad": [
              { fromNodeId: "00000000-0000-7000-8000-2e0d112b81ad", toNodeId: "00000000-0000-7000-8000-15e71779d221", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-2e0d112b81ad", toNodeId: "00000000-0000-7000-8000-27382bb1501f", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-2e0d112b81ad", toNodeId: "00000000-0000-7000-8000-3545230c4a70", weight: 1 },
            ],
            "00000000-0000-7000-8000-3545230c4a70": [
              { fromNodeId: "00000000-0000-7000-8000-3545230c4a70", toNodeId: "00000000-0000-7000-8000-15e71779d221", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-3545230c4a70", toNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-3545230c4a70", toNodeId: "00000000-0000-7000-8000-2e0d112b81ad", weight: 1 },
            ],
            "00000000-0000-7000-8000-3e8019d20e5e": [
              { fromNodeId: "00000000-0000-7000-8000-3e8019d20e5e", toNodeId: "00000000-0000-7000-8000-0f9ce613b8ef", weight: 1 },
            ],
            "00000000-0000-7000-8000-44f1f34484dc": [
              { fromNodeId: "00000000-0000-7000-8000-44f1f34484dc", toNodeId: "00000000-0000-7000-8000-15e71779d221", weight: 1 },
            ],
            "00000000-0000-7000-8000-4df67c46a1c5": [
              { fromNodeId: "00000000-0000-7000-8000-4df67c46a1c5", toNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-4df67c46a1c5", toNodeId: "00000000-0000-7000-8000-55b345dba0e8", weight: 1 },
            ],
            "00000000-0000-7000-8000-55b345dba0e8": [
              { fromNodeId: "00000000-0000-7000-8000-55b345dba0e8", toNodeId: "00000000-0000-7000-8000-1f0cb4b54a46", weight: 1 },
              { fromNodeId: "00000000-0000-7000-8000-55b345dba0e8", toNodeId: "00000000-0000-7000-8000-4df67c46a1c5", weight: 1 },
            ],
          },
        },
        units: {},
        resources: {
          money: 0,
        },
      })
    })

    it("should expose the current player and every opponent with their colors", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub({ nbSeats: 3 }),
      })
      await firstOpponent.client.lobbies.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.lobbies.join.mutate({ gameId: createdGameId })

      await creator.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.player).toEqual({ id: creator.account.id, color: PlayerColor.WHITE })
      expect(playerView.opponents).toEqual({
        [firstOpponent.account.id]: { id: firstOpponent.account.id, color: PlayerColor.RED },
        [secondOpponent.account.id]: { id: secondOpponent.account.id, color: PlayerColor.BLUE },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      await expect(player.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("setCurrentAction", () => {
    it("should round-trip every action variant for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: player.account.id, amountDelta: 10 }),
      )
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const sector = playerView.starSystem.orbits[0]?.sectors[0]
      Assert.isDefined(sector)

      for (const action of [
        { actionType: GamePlayerActionType.MAKE_MORE_MONEY },
        { actionType: GamePlayerActionType.WIN_THE_GAME },
        {
          actionType: GamePlayerActionType.BUILD_UNIT,
          destination: { targetType: "SECTOR", sectorId: sector.id },
        },
      ] as const) {
        // Act
        const setCurrentActionResult = await player.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 0,
          action,
        })
        const getCurrentActionResult = await player.client.gameplay.getCurrentAction.query({
          gameId: createdGameId,
        })

        // Assert
        expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
          action: {
            ...action,
            gameId: createdGameId,
            playerId: player.account.id,
            tick: 0,
            updatedAt: expect.any(String),
          },
        })
        expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>(setCurrentActionResult)
      }
    })

    it("should set a Build action targeting a Body", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: player.account.id, amountDelta: 1 }),
      )
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const body = playerView.starSystem.orbits.flatMap((orbit) => orbit.sectors.flatMap((sector) => sector.bodies))[0]
      Assert.isDefined(body)

      // Act
      const result = await player.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        action: {
          actionType: GamePlayerActionType.BUILD_UNIT,
          destination: { targetType: "BODY", bodyId: body.id },
        },
      })

      // Assert
      expect(result).toEqual<typeof result>({
        action: {
          gameId: createdGameId,
          playerId: player.account.id,
          tick: 0,
          actionType: GamePlayerActionType.BUILD_UNIT,
          destination: { targetType: "BODY", bodyId: body.id },
          updatedAt: expect.any(String),
        },
      })
    })

    it("should reject Build when the player has no money", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const sector = playerView.starSystem.orbits[0]?.sectors[0]
      Assert.isDefined(sector)

      // Act & Assert
      await expect(
        player.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 0,
          action: {
            actionType: GamePlayerActionType.BUILD_UNIT,
            destination: { targetType: "SECTOR", sectorId: sector.id },
          },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    it("should reject Build targets that do not belong to the game", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const firstGame = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      const secondGame = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: firstGame.createdGameId })
      await player.client.gameplay.startGame.mutate({ gameId: secondGame.createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: firstGame.createdGameId, playerId: player.account.id, amountDelta: 1 }),
      )
      const secondGameView = await player.client.gameplay.getPlayerView.query({ gameId: secondGame.createdGameId })
      const foreignSector = secondGameView.starSystem.orbits[0]?.sectors[0]
      Assert.isDefined(foreignSector)

      for (const sectorId of [foreignSector.id, "00000000-0000-4000-8000-000000000000"]) {
        // Act & Assert
        await expect(
          player.client.gameplay.setCurrentAction.mutate({
            gameId: firstGame.createdGameId,
            tick: 0,
            action: {
              actionType: GamePlayerActionType.BUILD_UNIT,
              destination: { targetType: "SECTOR", sectorId },
            },
          }),
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      }
    })

    it("should reject setting an action for a stale tick", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(
        player.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 1,
          action: { actionType: GamePlayerActionType.MAKE_MORE_MONEY },
        }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })
  })

  describe("getCurrentAction", () => {
    it("should get the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub(),
      })
      await player.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: player.account.id, amountDelta: 2 }),
      )

      // Act
      const getCurrentActionResult = await player.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.gameplay.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
