import { Assert, branded, Datetime, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createResourcesDtoStub } from "#api/gameplay/ResourcesDto.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetExceptional, BuildFleetImproved, BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import { GainEnergy } from "#lib/rulesets/standard/action-definitions/gain-energy.ts"
import { GainFuel } from "#lib/rulesets/standard/action-definitions/gain-fuel.ts"
import { GainInfluence } from "#lib/rulesets/standard/action-definitions/gain-influence.ts"
import { GainMetal } from "#lib/rulesets/standard/action-definitions/gain-metal.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "#lib/rulesets/standard/action-definitions/move-fleet.ts"
import { WinTheGame } from "#lib/rulesets/standard/action-definitions/win-the-game.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import { TurnsRepository } from "#turn-processing/turns.repository.ts"

describe("gameplay.router", () => {
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
      ]
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
        actions: expect.arrayContaining(expectedActions.map(withDefaultActionViewFields)),
      })
      expect(getPlayerViewResult.actions).toHaveLength(expectedActions.length)
      expect(repeatedGetPlayerViewResult.actions).toStrictEqual(getPlayerViewResult.actions)
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

  describe("updateActionSubmission", () => {
    integrationTest("should submit an action with valid planet targets", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      const homePlanet = initialPlayerView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      Assert.isDefined(homePlanet)

      // Act
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildFleet.id,
          selectedTargets: { planet: homePlanet.id },
        }),
      })

      // Assert
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView.actions.find(({ id }) => id === buildFleet.id)?.selectedTargets).toStrictEqual({ planet: homePlanet.id })
    })

    integrationTest("should persist the shared mixed-definition parity allocation through the public router", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(FleetActionParityRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: FleetActionParityRuleset.id,
          mapGenerationSeed: 1234,
          turnIntervalSeconds: 10,
        }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      let playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const planets = playerView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === playerView.player.id)
      const destination = planets.find(({ coordinates }) => coordinates === "55:07:50")
      Assert.isDefined(origin)
      Assert.isDefined(destination)
      expect({ x: origin.x, y: origin.y }).toStrictEqual(FleetActionSelectionParity.origin)
      expect({ x: destination.x, y: destination.y }).toStrictEqual(FleetActionSelectionParity.destination)

      // Act
      // Build all 50 source strength through the router and actual persisted turn processing.
      for (let buildCount = 0; buildCount < 5; buildCount += 1) {
        const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
        Assert.isDefined(buildAction)
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: buildAction.id,
            selectedTargets: { planet: origin.id },
            selectedInputs: {},
          }),
        })
        await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
        playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      }

      const sourceFleet = playerView.fleets[0]
      const standardAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
      const secondStandardAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
      const improvedAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_IMPROVED_1")
      Assert.isDefined(sourceFleet)
      Assert.isDefined(standardAction)
      Assert.isDefined(secondStandardAction)
      Assert.isDefined(improvedAction)
      expect(sourceFleet.strength).toBe(FleetActionSelectionParity.sourceStrength)
      expect(playerView.resources[ResourceType.INFLUENCE].total).toBe(FleetActionSelectionParity.totalResources.INFLUENCE)
      expect(playerView.resources[ResourceType.FUEL].total).toBe(FleetActionSelectionParity.totalResources.FUEL)

      // A partial API draft and a destination beyond Standard range cannot be persisted.
      const partialSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id },
          selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
        }),
      })
      await expect(partialSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const outsideStandardRange = planets.find(
        (planet) => planet.ownerPlayerId === null && planet.id !== origin.id && Math.hypot(planet.x - origin.x, planet.y - origin.y) > 5,
      )
      Assert.isDefined(outsideStandardRange)
      const outOfRangeSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: outsideStandardRange.id },
          selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
        }),
      })
      await expect(outOfRangeSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const missingForceSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: {},
        }),
      })
      await expect(missingForceSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const overStrengthSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 51 },
        }),
      })
      await expect(overStrengthSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      // The public DTO accepts only matched target/input objects or a matched null cancellation.
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: { actionId: standardAction.id, selectedTargets: null, selectedInputs: {} },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: { actionId: standardAction.id, selectedTargets: {}, selectedInputs: null },
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })

      // Exercise positive-safe-integer validation at the HTTP boundary, including JSON's null encoding
      // for non-finite JavaScript numbers.
      for (const invalidStrength of [
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
      ]) {
        await expect(
          player.client.gameplay.updateActionSubmission.mutate({
            gameId: createdGameId,
            turn: playerView.turn,
            submittedActionTargets: {
              actionId: standardAction.id,
              selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
              selectedInputs: { strength: invalidStrength },
            },
          }),
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      }

      const afterRejectedDrafts = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(afterRejectedDrafts).toStrictEqual(playerView)

      // The API accepts a full unreserved force of 50 and releases its costs when the draft is cancelled.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 50 },
        }),
      })
      const fullForceView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(fullForceView.actions.find(({ id }) => id === standardAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 50 },
      })
      expect(fullForceView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 3 })
      expect(fullForceView.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 3 })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: { actionId: standardAction.id, selectedTargets: null, selectedInputs: null },
      })
      const afterFullForceCancel = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(afterFullForceCancel.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 6 })
      expect(afterFullForceCancel.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 4 })

      // Exhaust the action costs while leaving one unallocated Strength; the third draft must fail atomically.
      for (const [action, strength] of [
        [standardAction, 20],
        [improvedAction, 29],
      ] as const) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: action.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength },
          }),
        })
      }
      const beforeThirdCostAttempt = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(beforeThirdCostAttempt.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
      expect(beforeThirdCostAttempt.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 0 })
      expect(beforeThirdCostAttempt.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(50)
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: secondStandardAction.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 1 },
          }),
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const afterThirdCostAttempt = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(afterThirdCostAttempt).toStrictEqual(beforeThirdCostAttempt)
      expect(afterThirdCostAttempt.actions.find(({ id }) => id === secondStandardAction.id)).toMatchObject({
        selectedTargets: null,
        selectedInputs: null,
        isInProgress: false,
      })

      for (const action of [standardAction, improvedAction]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: { actionId: action.id, selectedTargets: null, selectedInputs: null },
        })
      }
      const afterCostReservationCancel = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(afterCostReservationCancel.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 6 })
      expect(afterCostReservationCancel.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 4 })

      // A candidate beyond Standard's five-light-year range but within Improved's ten-light-year range is legal.
      const improvedOnlyDestination = planets.find((planet) => {
        const distance = Math.hypot(planet.x - origin.x, planet.y - origin.y)
        return planet.ownerPlayerId === null && distance > 5 && distance <= 10
      })
      Assert.isDefined(improvedOnlyDestination)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: improvedAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: improvedOnlyDestination.id },
          selectedInputs: { strength: 1 },
        }),
      })
      const improvedRangeView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(improvedRangeView.actions.find(({ id }) => id === improvedAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: improvedOnlyDestination.id },
        selectedInputs: { strength: 1 },
      })

      // Submit the same semantic vector used by the Storybook and shared resolver tests.
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: improvedAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
        }),
      })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: standardAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
        }),
      })

      // Assert
      const selectedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(selectedView.actions.find(({ id }) => id === standardAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
      })
      expect(selectedView.actions.find(({ id }) => id === improvedAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
      })
      expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 6, uncommitted: 0 })
      expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 4, uncommitted: 0 })
      expect(selectedView.fleets.find(({ id }) => id === sourceFleet.id)?.strength).toBe(FleetActionSelectionParity.sourceStrength)
    })

    integrationTest("should enforce Exceptional range and resolve configured movement speeds", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(TestMovementVerificationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId: gameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: TestMovementVerificationRuleset.id,
          mapGenerationSeed: 1234,
          turnIntervalSeconds: 10,
        }),
      })
      await player.client.games.startGame.mutate({ gameId })
      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      const initialView = await player.client.gameplay.getPlayerView.query({ gameId })
      const planets = initialView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const origin = planets.find(({ ownerPlayerId }) => ownerPlayerId === initialView.player.id)
      Assert.isDefined(origin)
      const unowned = planets.filter(({ ownerPlayerId, id }) => ownerPlayerId === null && id !== origin.id)
      const distanceFromOrigin = (planet: (typeof unowned)[number]): number => Math.hypot(planet.x - origin.x, planet.y - origin.y)
      const standardDestination = unowned.find(({ coordinates }) => coordinates === "45:87:40")
      const improvedDestination = unowned.find(({ coordinates }) => coordinates === "45:18:35")
      const exceptionalDestination = unowned.find(({ coordinates }) => coordinates === "54:18:10")
      const beyondExceptionalRange = unowned.find(({ coordinates }) => coordinates === "63:50:25")
      Assert.isDefined(standardDestination)
      Assert.isDefined(improvedDestination)
      Assert.isDefined(exceptionalDestination)
      Assert.isDefined(beyondExceptionalRange)
      expect(distanceFromOrigin(standardDestination)).toBeCloseTo(1.9357059928924176, 12)
      expect(distanceFromOrigin(improvedDestination)).toBeCloseTo(7.693909440718526, 12)
      expect(distanceFromOrigin(exceptionalDestination)).toBeCloseTo(10.129282735155494, 12)
      expect(distanceFromOrigin(beyondExceptionalRange)).toBeCloseTo(31.73237553747045, 12)

      const buildAction = initialView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId,
        turn: initialView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildAction.id,
          selectedTargets: { planet: origin.id },
          selectedInputs: {},
        }),
      })
      await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
      const builtView = await player.client.gameplay.getPlayerView.query({ gameId })
      const sourceFleet = builtView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const standardAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      const improvedAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
      const exceptionalAction = builtView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetExceptional.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(standardAction)
      Assert.isDefined(improvedAction)
      Assert.isDefined(exceptionalAction)

      // Act
      const beforeOutOfRangeAttempt = await player.client.gameplay.getPlayerView.query({ gameId })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: builtView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: exceptionalAction.id,
            selectedTargets: { fleet: sourceFleet.id, planet: beyondExceptionalRange.id },
            selectedInputs: { strength: 1 },
          }),
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      // Assert
      expect(await player.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeOutOfRangeAttempt)

      // Act
      for (const [action, destination] of [
        [standardAction, standardDestination],
        [improvedAction, improvedDestination],
        [exceptionalAction, exceptionalDestination],
      ] as const) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: builtView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: action.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 1 },
          }),
        })
      }
      const submittedView = await player.client.gameplay.getPlayerView.query({ gameId })
      expect(submittedView.actions.find(({ id }) => id === exceptionalAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: exceptionalDestination.id },
        selectedInputs: { strength: 1 },
      })
      await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
      const resolvedView = await player.client.gameplay.getPlayerView.query({ gameId })

      // Assert
      for (const [action, destination, speed, expectedRemainingDistance] of [
        [standardAction, standardDestination, 0.1, Number.parseFloat("1.8357059928924176")],
        [improvedAction, improvedDestination, 1, 6.693909440718526],
        [exceptionalAction, exceptionalDestination, 5, 5.129282735155494],
      ] as const) {
        const journey = resolvedView.fleets.find(({ movement }) => movement?.submission.id === action.id)
        Assert.isDefined(journey)
        expect(journey).toMatchObject({
          ownerPlayerId: initialView.player.id,
          originPlanetId: origin.id,
          destinationPlanetId: destination.id,
          strength: 1,
          distanceToEnd: expect.closeTo(expectedRemainingDistance, 12),
          movement: {
            speed,
            departureTurn: submittedView.turn,
            submission: {
              id: action.id,
              actionDefinitionId: action.actionDefinitionId,
              selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
              selectedInputs: { strength: 1 },
            },
          },
        })
      }
      expect(resolvedView.fleets.find(({ id, movement }) => id === sourceFleet.id && movement === undefined)?.strength).toBe(7)
    })

    integrationTest("should reject a Fleet ID that exists only in another game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const { api, accountsRepository } = await createApiStub({ db, clock })
      using apiServer = new ApiServer({ api, accountsRepository })
      const player = await apiServer.createClient({ authenticated: true })
      const configuration = createGameConfigurationStub({ mapGenerationSeed: 1234, turnIntervalSeconds: 10 })
      const { createdGameId: sourceGameId } = await player.client.games.create.mutate({ configuration })
      const { createdGameId: targetGameId } = await player.client.games.create.mutate({ configuration })
      await player.client.games.startGame.mutate({ gameId: sourceGameId })
      await player.client.games.startGame.mutate({ gameId: targetGameId })

      const sourceView = await player.client.gameplay.getPlayerView.query({ gameId: sourceGameId })
      const sourceHome = sourceView.galaxy.systems
        .flatMap(({ planets }) => planets)
        .find(({ ownerPlayerId }) => ownerPlayerId === branded(player.account.id))
      const buildAction = sourceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(sourceHome)
      Assert.isDefined(buildAction)
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: sourceGameId,
        turn: sourceView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildAction.id,
          selectedTargets: { planet: sourceHome.id },
          selectedInputs: {},
        }),
      })

      const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      const sourceGameAfterTurn = await player.client.gameplay.getPlayerView.query({ gameId: sourceGameId })
      const foreignFleet = sourceGameAfterTurn.fleets[0]
      Assert.isDefined(foreignFleet)

      const targetView = await player.client.gameplay.getPlayerView.query({ gameId: targetGameId })
      const moveAction = targetView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      const targetPlanet = targetView.galaxy.systems.flatMap(({ planets }) => planets).find(({ ownerPlayerId }) => ownerPlayerId === null)
      Assert.isDefined(moveAction)
      Assert.isDefined(targetPlanet)
      const targetResourcesBefore = targetView.resources

      // Act
      const submission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: targetGameId,
        turn: targetView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: moveAction.id,
          selectedTargets: { fleet: foreignFleet.id, planet: targetPlanet.id },
          selectedInputs: { strength: 1 },
        }),
      })

      // Assert
      await expect(submission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const targetViewAfter = await player.client.gameplay.getPlayerView.query({ gameId: targetGameId })
      const unchangedMoveAction = targetViewAfter.actions.find(({ id }) => id === moveAction.id)
      Assert.isDefined(unchangedMoveAction)
      expect(unchangedMoveAction.selectedTargets).toBeNull()
      expect(unchangedMoveAction.selectedInputs).toBeNull()
      expect(unchangedMoveAction.isInProgress).toBe(false)
      expect(targetViewAfter.resources).toStrictEqual(targetResourcesBefore)
    })
    integrationTest("should update only the submitting player's Action when players share stable Action IDs", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const opponent = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await opponent.client.games.join.mutate({ gameId: createdGameId })
      await creator.client.games.startGame.mutate({ gameId: createdGameId })

      const creatorView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const creatorAction = creatorView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(creatorAction)

      const opponentView = await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const opponentAction = opponentView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(opponentAction)

      // Act
      await creator.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: creatorView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: creatorAction.id, selectedTargets: {} }),
      })

      // Assert
      expect(creatorAction.id).toBe(opponentAction.id)
      expect(
        (await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === creatorAction.id),
      ).toMatchObject({ selectedTargets: {} })
      expect(
        (await opponent.client.gameplay.getPlayerView.query({ gameId: createdGameId })).actions.find(({ id }) => id === opponentAction.id),
      ).toMatchObject({ selectedTargets: null })
    })

    integrationTest("should submit and deselect multiple actions", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const gainFuel = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainFuel.id)
      const gainMetal = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainMetal.id)
      Assert.isDefined(gainFuel)
      Assert.isDefined(gainMetal)

      // Act
      for (const action of [gainFuel, gainMetal]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: {} }),
        })
      }
      const selectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      for (const action of [gainFuel, gainMetal]) {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: initialPlayerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: action.id, selectedTargets: null }),
        })
      }
      const deselectedPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const expectedSelectedActions = [
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
          canAfford: false,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainFuel.id,
          selectedTargets: {},
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: GainMetal.id,
          selectedTargets: {},
          canAfford: true,
        },
        {
          id: expect.any(String),
          actionDefinitionId: BuildFleetStandard.id,
          selectedTargets: null,
          canAfford: false,
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
          canAfford: false,
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
      ]
      expect(selectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedSelectedActions.map(withDefaultActionViewFields)))
      expect(selectedPlayerView.actions).toHaveLength(expectedSelectedActions.length)

      const expectedDeselectedActions = [
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
      ]
      expect(deselectedPlayerView.actions).toStrictEqual(expect.arrayContaining(expectedDeselectedActions.map(withDefaultActionViewFields)))
      expect(deselectedPlayerView.actions).toHaveLength(expectedDeselectedActions.length)
    })

    integrationTest.for(["constructor", "toString"])(
      "should reject inherited input name %s for an action with no inputs",
      async (inputTag, { db }) => {
        // Arrange
        using apiServer = new ApiServer(await createApiStub({ db }))
        const player = await apiServer.createClient({ authenticated: true })
        const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
        await player.client.games.startGame.mutate({ gameId: createdGameId })

        const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
        const campaign = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
        Assert.isDefined(campaign)

        // Act
        const invalidSubmission = player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: campaign.id,
            selectedTargets: {},
            selectedInputs: Object.fromEntries([[inputTag, 1]]),
          }),
        })

        // Assert
        await expect(invalidSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      },
    )

    integrationTest("should reject an action with invalid planet targets", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))

      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })

      const initialPlayerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      const buildFleet = initialPlayerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(buildFleet)

      // Act
      const invalidSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: initialPlayerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: buildFleet.id,
          selectedTargets: { planet: "123456789" },
        }),
      })

      // Assert
      await expect(invalidSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject setting an action for a stale turn", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)

      // Act
      const updateActionSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 0,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: makeMoreMoney.id, selectedTargets: {} }),
      })

      // Assert
      await expect(updateActionSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject setting an action after the turn deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({ turnIntervalSeconds: 10 }),
      })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })

      // Act
      const updateActionSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: makeMoreMoney.id, selectedTargets: {} }),
      })

      // Assert
      await expect(updateActionSubmission).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
    })

    integrationTest("should reject an action the player cannot afford", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const winTheGame = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === WinTheGame.id)
      Assert.isDefined(winTheGame)

      // Act
      const setActionPromise = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: winTheGame.id, selectedTargets: {} }),
      })

      // Assert
      await expect(setActionPromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })

    integrationTest("should reject an action that is not available to the player", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({ configuration: createGameConfigurationStub() })
      await player.client.games.startGame.mutate({ gameId: createdGameId })
      const playerView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const makeMoreMoney = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      Assert.isDefined(makeMoreMoney)

      // Act
      const setActionPromise = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: 1,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({ actionId: "unavailable-action", selectedTargets: {} }),
      })

      // Assert
      await expect(setActionPromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    })
  })

  // This test suite is often failing, but only in the CI. Not sure if it is hanging or just taking longer.
  // If we get timeouts on a 20s budget, this is definitely hanging and there's an issue running on the CI that we should address.
  describe("updateReadiness", { timeout: 20_000 }, () => {
    integrationTest.for([true, false])("should set the player readiness to %s", async (isReady, { db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId }) // 2nd player to avoid turn processing on ready

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: !isReady }) // Making sure the status will change
      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady })

      // Assert
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>({
        ...initialPlayerView,
        player: {
          ...initialPlayerView.player,
          isReady,
        },
      })
    })

    integrationTest("should close the turn and submit for processing when all players are ready", async ({ db }) => {
      // Arrange
      const logger = Logger.get()
      const clock = new ControlledClock()
      const turnsRepository = new TurnsRepository({ db, logger })

      const apiServices = await createApiStub({ db, clock })
      using apiServer = new ApiServer(apiServices)
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })
      await player.client.games.join.mutate({ gameId: createdGameId })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      await player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithOnePlayerReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      await creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })
      const playerViewWithAllPlayersReady = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Assert
      const playerId = branded<PlayerId>(player.account.id)
      const initialPlayer = initialPlayerView.opponents[playerId]
      Assert.isDefined(initialPlayer)

      expect(playerViewWithOnePlayerReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })
      expect(playerViewWithAllPlayersReady).toStrictEqual<typeof playerViewWithAllPlayersReady>({
        ...initialPlayerView,
        turnStatus: TurnStatus.AWAITING_PROCESSING,
        player: {
          ...initialPlayerView.player,
          isReady: true,
        },
        opponents: {
          [playerId]: {
            ...initialPlayer,
            isReady: true,
          },
        },
      })

      const turnForProcessing = await apiServices.createTransaction(
        async (tx) => await turnsRepository.getNextTurnForProcessing({ since: clock.now() }, tx),
      )
      expect(turnForProcessing).toStrictEqual<typeof turnForProcessing>(Result.Success(branded({ gameId: createdGameId, turn: 1 })))
    })

    integrationTest("should reject readiness for the wrong turn", async ({ db }) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub({ db }))
      const creator = await apiServer.createClient({ authenticated: true })

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 0, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness past the deadline", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })

      const turnInterval = Time.create(10, UnitOfTime.SECONDS)
      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          mapGenerationSeed: 1234,
          turnIntervalSeconds: Time.in(turnInterval, UnitOfTime.SECONDS),
        }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      clock.increment({ time: turnInterval })
      const updateReadiness = creator.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })

    integrationTest("should reject readiness for players not in the game", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      using apiServer = new ApiServer(await createApiStub({ db, clock }))
      const creator = await apiServer.createClient({ authenticated: true })
      const player = await apiServer.createClient({ authenticated: true }) // not in the game

      const { createdGameId } = await creator.client.games.create.mutate({
        configuration: createGameConfigurationStub({ mapGenerationSeed: 1234 }),
      })

      await creator.client.games.startGame.mutate({ gameId: createdGameId })
      const initialPlayerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })

      // Act
      const updateReadiness = player.client.gameplay.updateReadiness.mutate({ gameId: createdGameId, turn: 1, isReady: true })

      // Assert
      await expect(updateReadiness).rejects.toMatchObject({ data: { code: "FORBIDDEN" } })
      const playerView = await creator.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(playerView).toStrictEqual<typeof playerView>(initialPlayerView)
    })
  })
})

const FleetActionParityRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_fleet_action_selection_parity",
  actionPool: [...TestRuleset.actionPool, { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id }],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 16,
    [ResourceType.METAL]: 5,
    [ResourceType.FUEL]: 4,
  },
})

const TestMovementVerificationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_movement_ranges_and_speeds",
  name: "Test Movement Range and Speed Verification",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 100,
    [ResourceType.METAL]: 100,
    [ResourceType.FUEL]: 100,
  },
})

async function processNextRouterTurn({
  clock,
  turnProcessor,
  turnsRepository,
}: {
  clock: ControlledClock
  turnProcessor: Awaited<ReturnType<typeof createTurnProcessorStub>>["turnProcessor"]
  turnsRepository: TurnsRepository
}): Promise<void> {
  clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
  await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
  expect(await turnProcessor.processNextDueTurn()).toBe("processed")
}

function withDefaultActionViewFields<T extends { selectedTargets: unknown }>(
  action: T,
): T & { selectedInputs: unknown; isInProgress: false } {
  return {
    ...action,
    selectedInputs: action.selectedTargets === null ? null : {},
    isInProgress: false,
  }
}
