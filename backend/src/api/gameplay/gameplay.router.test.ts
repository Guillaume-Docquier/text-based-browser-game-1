import { Datetime, Range, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { describe, expect, it } from "vitest"
import { createNewAccountModelStub } from "#api/accounts/NewAccountModel.stub.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { createGameConfigurationDtoStub } from "#api/lobbies/GameConfigurationDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { GamePlayerActionType } from "#lib/db/gameplay/gamePlayerActionType.ts"
import { BodyType } from "#lib/db/star-systems/BodyType.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"
import { extractSuccess } from "#tests/extractSuccess.ts"
import { ResourcesRepository } from "#tests/resources/resources.repository.ts"
import { createResourceUpdateModelStub } from "#tests/resources/ResourceUpdateModel.stub.ts"
import { TrpcServer } from "#tests/TrpcServer.ts"

describe("gameplay.router", () => {
  it("should reject all gameplay routes when the authenticated player has not joined the game", async () => {
    // Arrange
    const { api, accountsRepository } = await createApiStub()

    const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    using creatorTrpcServer = new TrpcServer({ api, account: creatorAccount })

    const nonPlayerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
    using nonPlayerTrpcServer = new TrpcServer({ api, account: nonPlayerAccount })

    const { createdGameId } = await creatorTrpcServer.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayerTrpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayerTrpcServer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayerTrpcServer.client.gameplay.getCurrentAction.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(
      nonPlayerTrpcServer.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("start", () => {
    it("should start a game", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      const newGameSettings = createGameConfigurationDtoStub()
      const { createdGameId } = await trpcServer.client.lobbies.create.mutate({ configuration: newGameSettings })

      // Act
      const startGameResult = await trpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Assert
      expect(startGameResult).toEqual<typeof startGameResult>({ nextTickAt: expect.any(String) }) // trpc serializes the date to string
      expect(new Date(startGameResult.nextTickAt).toString()).not.toBe("Invalid Date")
    })

    it("should reject starting a game as a non-creator", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()

      const creatorAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using creatorTrpcServer = new TrpcServer({ api, account: creatorAccount })

      const joinerAccount = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using joinerTrpcServer = new TrpcServer({ api, account: joinerAccount })

      const { createdGameId } = await creatorTrpcServer.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await joinerTrpcServer.client.lobbies.join.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(joinerTrpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should start two games with identical deterministic Star Systems", async () => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ clock })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      const gameConfiguration = createGameConfigurationDtoStub({
        starSystemGenerationSettings: createStarSystemGenerationSettingsStub({ seed: 42 }),
      })
      const firstGame = await trpcServer.client.lobbies.create.mutate({ configuration: gameConfiguration })
      const secondGame = await trpcServer.client.lobbies.create.mutate({ configuration: gameConfiguration })

      // Act
      await trpcServer.client.gameplay.startGame.mutate({ gameId: firstGame.createdGameId })
      await trpcServer.client.gameplay.startGame.mutate({ gameId: secondGame.createdGameId })

      // Assert
      const game1View = await trpcServer.client.gameplay.getPlayerView.query({ gameId: firstGame.createdGameId })
      const game2View = await trpcServer.client.gameplay.getPlayerView.query({ gameId: secondGame.createdGameId })
      expect(game1View.starSystem).toEqual(game2View.starSystem)
    })

    it("should reject anonymous game start", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcServer = new TrpcServer({ api })

      // Act & Assert
      await expect(trpcServer.client.gameplay.startGame.mutate({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("getById", () => {
    it("should get the authenticated player's state for a started game", async () => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ clock })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

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
      const { createdGameId } = await trpcServer.client.lobbies.create.mutate({ configuration: gameConfiguration })

      await trpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act
      const getByIdResult = await trpcServer.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      // This is basically a snapshot test since we've tested the star systems extensively already in unit tests
      expect(getByIdResult).toEqual<typeof getByIdResult>({
        gameId: createdGameId,
        playerId: account.id,
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
        resources: {
          money: 0,
        },
      })
    })

    it("should reject invalid game ids", async () => {
      // Arrange

      const { api, accountsRepository } = await createApiStub()

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      // Act & Assert
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      await expect(trpcServer.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    it("should reject anonymous game state reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcServer = new TrpcServer({ api })

      // Act & Assert
      await expect(trpcServer.client.gameplay.getPlayerView.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })

  describe("setCurrentAction", () => {
    it("should set the current action for the authenticated player", async () => {
      // Arrange
      const db = await createDbMock()
      const { api, logger, accountsRepository } = await createApiStub({ db })
      const resourcesRepository = new ResourcesRepository({ db, logger })

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      const { createdGameId } = await trpcServer.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await trpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const setCurrentActionResult = await trpcServer.client.gameplay.setCurrentAction.mutate({
        gameId: createdGameId,
        tick: 0,
        actionType: GamePlayerActionType.MAKE_MORE_MONEY,
      })
      const getCurrentActionResult = await trpcServer.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(setCurrentActionResult).toEqual<typeof setCurrentActionResult>({
        action: {
          gameId: createdGameId,
          playerId: account.id,
          tick: 0,
          actionType: GamePlayerActionType.MAKE_MORE_MONEY,
          updatedAt: expect.any(String),
        },
      })
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>(setCurrentActionResult)
    })

    it("should reject setting an action for a stale tick", async () => {
      // Arrange
      const { api, accountsRepository } = await createApiStub()

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      const { createdGameId } = await trpcServer.client.lobbies.create.mutate({ configuration: createGameConfigurationDtoStub() })
      await trpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })

      // Act & Assert
      await expect(
        trpcServer.client.gameplay.setCurrentAction.mutate({
          gameId: createdGameId,
          tick: 1,
          actionType: GamePlayerActionType.MAKE_MORE_MONEY,
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

      const account = extractSuccess(await accountsRepository.createAccount(createNewAccountModelStub()))
      using trpcServer = new TrpcServer({ api, account })

      const { createdGameId } = await trpcServer.client.lobbies.create.mutate({
        configuration: createGameConfigurationDtoStub(),
      })
      await trpcServer.client.gameplay.startGame.mutate({ gameId: createdGameId })
      await resourcesRepository.updateResource(
        createResourceUpdateModelStub({ gameId: createdGameId, playerId: account.id, amountDelta: 2 }),
      )

      // Act
      const getCurrentActionResult = await trpcServer.client.gameplay.getCurrentAction.query({
        gameId: createdGameId,
      })

      // Assert
      expect(getCurrentActionResult).toEqual<typeof getCurrentActionResult>({ action: null })
    })

    it("should reject anonymous action reads", async () => {
      // Arrange
      const { api } = await createApiStub()
      using trpcServer = new TrpcServer({ api })

      // Act & Assert
      await expect(trpcServer.client.gameplay.getCurrentAction.query({ gameId: 1 })).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      })
    })
  })
})
