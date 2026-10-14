import { Assert, branded, Datetime, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { afterEach, describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { withDefaultActionViewFields } from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("gameplay.router", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  integrationTest("should reject all gameplay routes when the authenticated player has not joined the game", async ({ db }) => {
    // Arrange
    using apiServer = new ApiServer(await createApiStub({ db }))
    const creator = await apiServer.createClient({ authenticated: true })
    const nonPlayer = await apiServer.createClient({ authenticated: true })

    const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })

    // Act & Assert
    const expectedError = { data: { code: "FORBIDDEN" } }
    await expect(nonPlayer.client.gameplay.getPlayerView.query({ gameId: createdGameId })).rejects.toMatchObject(expectedError)
    await expect(nonPlayer.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })).rejects.toMatchObject(
      expectedError,
    )
    await expect(
      nonPlayer.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub(),
      }),
    ).rejects.toMatchObject(expectedError)
  })

  describe("getPlayerView", () => {
    integrationTest("should get the authenticated player's state for a started game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const gameConfiguration = createGameConfigurationStub()
      const { createdGameId } = await player.client.games.create.mutate({ configuration: gameConfiguration })

      await player.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const getPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const repeatedGetPlayerViewResult = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const expectedActions = [
        {
          id: expect.any(String),
          actionDefinitionId: GainInfluence.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: WinTheGame.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainEnergy.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainFuel.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainMetal.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetStandard.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: "MOVE_FLEET_IMPROVED_2",
          actionDefinitionId: MoveFleetImproved.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: MoveFleetExceptional.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: AttackMoveTest.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: FlexibleAssaultTest.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: StationaryAssaultTest.id,
          selectedTargets: null,
          canAfford: true,
        },
        {
          id: "TEST_COLONIZE_PLANET_1",
          actionDefinitionId: ColonizePlanetTest.id,
          selectedTargets: null,
          canAfford: false,
        },
        {
          id: "TEST_COLONIZE_HERE_1",
          actionDefinitionId: ColonizeHereTest.id,
          selectedTargets: null,
          canAfford: false,
        },
      ]

      assertGetPlayerViewResult2({
        getPlayerViewResult,
        createdGameId,
        player,
        clock,
        gameConfiguration,
        expectedActions,
        repeatedGetPlayerViewResult,
      })
    })

    integrationTest("should expose uncommitted resources and use them to determine Action affordability", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const generatePower = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
      Assert.isDefined(generatePower)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: generatePower.id, selectedTargets: {} }),
      })

      // Act
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const selectedGeneratePower = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainEnergy.id)
      const extractMetal = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
      Assert.isDefined(selectedGeneratePower)
      Assert.isDefined(extractMetal)

      // Assert
      expect(playerView.resources).toStrictEqual<typeof playerView.resources>(
        createResourcesDtoStub({
          [ResourceType.INFLUENCE]: { uncommitted: 0, total: 3 },
          [ResourceType.METAL]: { uncommitted: 2, total: 2 },
          [ResourceType.FUEL]: { uncommitted: 0, total: 1 },
        }),
      )
      expect(selectedGeneratePower.canAfford).toBe(true)
      expect(extractMetal.canAfford).toBe(false)
    })

    integrationTest("should expose the current player and every opponent with their colors", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const firstOpponent = await apiServer.createClient({ authenticated: true })
      const secondOpponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ nbSeats: 3 }),
      })
      await firstOpponent.client.games.join.mutate({ gameId: createdGameId })
      await secondOpponent.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      // Act
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      expect(playerView.player).toStrictEqual({ id: creator.account.id, color: PlayerColor.TURQUOISE, isReady: false })
      expect(playerView.opponents).toStrictEqual({
        [firstOpponent.account.id]: { id: firstOpponent.account.id, color: PlayerColor.PINK, isReady: false },
        [secondOpponent.account.id]: { id: secondOpponent.account.id, color: PlayerColor.YELLOW, isReady: false },
      })
    })

    integrationTest("should reject invalid game ids", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      // Act
      // @ts-expect-error Testing runtime input parsing with an invalid game id
      const getPlayerView = player.client.gameplay.getPlayerView.query({ gameId: "not-a-game-id" })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject anonymous game state reads", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const getPlayerView = anonymous.client.gameplay.getPlayerView.query({ gameId: 1 })

      // Assert
      await expect(getPlayerView).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })
  })
})

function assertGetPlayerViewResult2({
  getPlayerViewResult,
  createdGameId,
  player,
  clock,
  gameConfiguration,
  expectedActions,
  repeatedGetPlayerViewResult,
}: AssertGetPlayerViewResult2Input): void {
  expect(getPlayerViewResult).toStrictEqual<typeof getPlayerViewResult>({
    gameId: createdGameId,
    player: { id: branded(player.account.id), color: PlayerColor.TURQUOISE, isReady: false },
    opponents: {},
    galaxy: expect.any(Object), // Verified by the snapshot test
    fleets: [],
    turn: 1,
    turnStatus: "COLLECTING_ACTIONS",
    turnEndsAt: Datetime.increment({
      date: clock.now(),
      time: Time.create(gameConfiguration.turnIntervalSeconds, UnitOfTime.SECONDS),
    }).toISOString(),
    resources: createResourcesDtoStub({
      [ResourceType.INFLUENCE]: { uncommitted: 3, total: 3 },
      [ResourceType.METAL]: { uncommitted: 2, total: 2 },
      [ResourceType.FUEL]: { uncommitted: 1, total: 1 },
    }),
    ruleset: TestRuleset,
    actions: expect.any(Array),
  })
  expect(getPlayerViewResult.actions).toStrictEqual(expect.arrayContaining(expectedActions.map(withDefaultActionViewFields)))
  expect(getPlayerViewResult.actions).toHaveLength(expectedActions.length)
  expect(repeatedGetPlayerViewResult.actions).toStrictEqual(getPlayerViewResult.actions)
}

type AssertGetPlayerViewResult2Input = {
  getPlayerViewResult: PlayerView
  createdGameId: GameId
  player: AuthenticatedApiClient
  clock: ControlledClock
  gameConfiguration: ReturnType<typeof createGameConfigurationStub>
  expectedActions: Array<{ id: unknown; actionDefinitionId: ActionDefinitionId; selectedTargets: null; canAfford: false | true }>
  repeatedGetPlayerViewResult: PlayerView
}
