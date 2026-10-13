import { Assert, branded, Datetime, indexBy, Logger, Result, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import {
  evaluateSubmittedActions,
  evaluateTargetCandidate,
  type EligibilityState,
} from "shared/action-submission/evaluateActionSelection.ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { PlayerColor } from "shared/domain/players/PlayerColor.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetBuildEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetBuildEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceGainEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceGainEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { FleetActionSelectionParity, FleetActionSelectionParityActionPool } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest, FlexibleAssaultTest, StationaryAssaultTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { ColonizeHereTest, ColonizePlanetTest, SeedOutpostTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { afterEach, describe, expect, vi } from "vitest"
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
import { type TurnToProcessModel, TurnsRepository } from "#turn-processing/turns.repository.ts"

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
      const retainedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const retainedSource = retainedView.fleets.find(({ id }) => id === sourceFleet.id)
      Assert.isDefined(retainedSource)
      const normalizedInput = {
        resources: {
          total: Object.fromEntries(
            Object.values(ResourceType).map((resourceType) => [resourceType, retainedView.resources[resourceType].total]),
          ),
          uncommitted: Object.fromEntries(
            Object.values(ResourceType).map((resourceType) => [resourceType, retainedView.resources[resourceType].uncommitted]),
          ),
        },
        source: {
          role: "source",
          owner: retainedSource.ownerPlayerId === retainedView.player.id ? "player" : "other",
          strength: retainedSource.strength,
          origin: retainedSource.originPlanetId === origin.id ? "origin" : "other",
          movement: retainedSource.movement ?? null,
        },
        planets: [
          {
            role: "origin",
            owner: origin.ownerPlayerId === retainedView.player.id ? "player" : origin.ownerPlayerId,
            x: origin.x,
            y: origin.y,
          },
          {
            role: "destination",
            owner: destination.ownerPlayerId === null ? null : "other",
            x: destination.x,
            y: destination.y,
          },
        ],
        authorizedActions: retainedView.ruleset.actionPool
          .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
          .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
        currentActions: retainedView.actions
          .map(({ id, actionDefinitionId, selectedTargets, selectedInputs, isInProgress }) => ({
            id,
            actionDefinitionId,
            selectedTargets:
              selectedTargets === null
                ? null
                : {
                    fleet:
                      selectedTargets[branded<TargetTag>("fleet")] === retainedSource.id
                        ? "source"
                        : selectedTargets[branded<TargetTag>("fleet")],
                    planet:
                      selectedTargets[branded<TargetTag>("planet")] === destination.id
                        ? "destination"
                        : selectedTargets[branded<TargetTag>("planet")],
                  },
            selectedInputs,
            isInProgress,
          }))
          .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
        candidate: {
          id: standardAction.id,
          actionDefinitionId: standardAction.actionDefinitionId,
          selectedTargets: { fleet: "source", planet: "destination" },
          selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
        },
      }
      expect(normalizedInput).toStrictEqual(FleetActionSelectionParity.normalizedInput)
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

      const selectedSource = selectedView.fleets.find(({ id }) => id === sourceFleet.id)
      const selectedPlanets = selectedView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
      const selectedOrigin = selectedPlanets.find(({ id }) => id === origin.id)
      const selectedDestination = selectedPlanets.find(({ id }) => id === destination.id)
      Assert.isDefined(selectedSource)
      Assert.isDefined(selectedOrigin)
      Assert.isDefined(selectedDestination)

      const isStringRecord = (value: unknown): value is Record<string, string> =>
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((entry) => typeof entry === "string")

      const normalizeAction = (action: {
        id: string
        actionDefinitionId: string
        selectedTargets: unknown
        selectedInputs: unknown
        isInProgress: boolean
      }): {
        id: string
        actionDefinitionId: string
        selectedTargets: { fleet: string | undefined; planet: string | undefined } | null
        selectedInputs: unknown
        isInProgress: boolean
      } => {
        let selectedTargets: Record<string, string> | null = null
        if (action.selectedTargets !== null) {
          if (!isStringRecord(action.selectedTargets)) {
            throw new Error("Expected selected action targets to be a string map")
          }
          selectedTargets = action.selectedTargets
        }
        return {
          id: action.id,
          actionDefinitionId: action.actionDefinitionId,
          selectedTargets:
            selectedTargets === null
              ? null
              : {
                  fleet: selectedTargets.fleet === sourceFleet.id ? "source" : selectedTargets.fleet,
                  planet: selectedTargets.planet === destination.id ? "destination" : selectedTargets.planet,
                },
          selectedInputs: action.selectedInputs,
          isInProgress: action.isInProgress,
        }
      }

      const normalizedSelectedView = {
        resources: {
          total: Object.fromEntries(
            Object.values(ResourceType).map((resourceType) => [resourceType, selectedView.resources[resourceType].total]),
          ),
          uncommitted: Object.fromEntries(
            Object.values(ResourceType).map((resourceType) => [resourceType, selectedView.resources[resourceType].uncommitted]),
          ),
        },
        source: {
          role: "source",
          owner: selectedSource.ownerPlayerId === selectedView.player.id ? "player" : "other",
          strength: selectedSource.strength,
          origin: selectedSource.originPlanetId === origin.id ? "origin" : "other",
          movement: selectedSource.movement ?? null,
        },
        planets: [
          {
            role: "origin",
            owner: selectedOrigin.ownerPlayerId === selectedView.player.id ? "player" : selectedOrigin.ownerPlayerId,
            x: selectedOrigin.x,
            y: selectedOrigin.y,
          },
          {
            role: "destination",
            owner: selectedDestination.ownerPlayerId === null ? null : "other",
            x: selectedDestination.x,
            y: selectedDestination.y,
          },
        ],
        authorizedActions: selectedView.ruleset.actionPool
          .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
          .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
        currentActions: selectedView.actions.map(normalizeAction).toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
      }
      expect(normalizedSelectedView).toStrictEqual(FleetActionSelectionParity.lockedNormalizedInput)

      // Observe the exact production-loaded worker input inside the real worker call.
      clock.increment({ time: Time.create(10, UnitOfTime.SECONDS) })
      await turnsRepository.markDueTurnsAwaitingProcessing({ since: clock.now() })
      const delegateStartTurnProcessing = turnsRepository.startTurnProcessing.bind(turnsRepository)
      const lockedInputObserver = vi.spyOn(turnsRepository, "startTurnProcessing").mockImplementation(async (startModel, tx) => {
        expect(startModel.turn.gameId).toBe(createdGameId)
        expect(startModel.turn.turn).toBe(selectedView.turn)

        // Delegate the real loader unchanged. This is the same object the production worker will resolve after the spy returns.
        const lockedInput: TurnToProcessModel = await delegateStartTurnProcessing(startModel, tx)
        expect(lockedInput.gameId).toBe(createdGameId)
        expect(lockedInput.turn).toBe(selectedView.turn)
        expect(selectedView.ruleset).toStrictEqual(FleetActionParityRuleset)
        expect(lockedInput.ruleset).toStrictEqual(selectedView.ruleset)
        expect(lockedInput.ruleset.actionPool).toStrictEqual(selectedView.ruleset.actionPool)

        const lockedPlayer = lockedInput.players[selectedView.player.id]
        const lockedSource = lockedInput.fleets[sourceFleet.id]
        const lockedOrigin = lockedInput.planets[origin.id]
        const lockedDestination = lockedInput.planets[destination.id]
        Assert.isDefined(lockedPlayer)
        Assert.isDefined(lockedSource)
        Assert.isDefined(lockedOrigin)
        Assert.isDefined(lockedDestination)
        const lockedSubmissions = lockedInput.submittedActions.filter(({ playerId }) => playerId === selectedView.player.id)
        const lockedActions = lockedInput.ruleset.actionPool.map(({ id, actionDefinitionId }) => {
          const submission = lockedSubmissions.find(({ id: submittedActionId }) => submittedActionId === id)
          return {
            id,
            actionDefinitionId,
            selectedTargets: submission?.selectedTargets ?? null,
            selectedInputs: submission?.selectedInputs ?? null,
            isInProgress: false,
          }
        })
        const lockedEvaluationState: EligibilityState = {
          gameId: lockedInput.gameId,
          turn: lockedInput.turn,
          submittingPlayerId: selectedView.player.id,
          resources: lockedPlayer.resources,
          players: indexBy(
            "id",
            Object.values(lockedInput.players).map(({ id }) => ({ id, ownerPlayerId: id })),
          ),
          planets: indexBy("id", Object.values(lockedInput.planets)),
          fleets: indexBy("id", Object.values(lockedInput.fleets)),
          actions: lockedInput.ruleset.actionPool.map(({ id, actionDefinitionId }) => {
            const submission = lockedSubmissions.find(({ id: submittedActionId }) => submittedActionId === id)
            return submission ?? createAvailableActionStub({ id, playerId: selectedView.player.id, actionDefinitionId })
          }),
        }
        const lockedEvaluation = evaluateSubmittedActions({
          state: lockedEvaluationState,
          ruleset: lockedInput.ruleset,
          submissions: lockedSubmissions,
        })
        const normalizedLockedInput = {
          resources: {
            total: Object.fromEntries(
              Object.values(ResourceType).map((resourceType) => [resourceType, lockedPlayer.resources[resourceType]]),
            ),
            uncommitted: Object.fromEntries(
              Object.values(ResourceType).map((resourceType) => [
                resourceType,
                lockedPlayer.resources[resourceType] - lockedEvaluation.resourceCommitments[resourceType],
              ]),
            ),
          },
          source: {
            role: "source",
            owner: lockedSource.ownerPlayerId === selectedView.player.id ? "player" : "other",
            strength: lockedSource.strength,
            origin: lockedSource.originPlanetId === origin.id ? "origin" : "other",
            movement: lockedSource.movement ?? null,
          },
          planets: [
            {
              role: "origin",
              owner: lockedOrigin.ownerPlayerId === selectedView.player.id ? "player" : lockedOrigin.ownerPlayerId,
              x: lockedOrigin.x,
              y: lockedOrigin.y,
            },
            {
              role: "destination",
              owner: lockedDestination.ownerPlayerId === null ? null : "other",
              x: lockedDestination.x,
              y: lockedDestination.y,
            },
          ],
          authorizedActions: lockedInput.ruleset.actionPool
            .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
            .toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
          currentActions: lockedActions.map(normalizeAction).toSorted((first, second) => compareOrdinalStrings(first.id, second.id)),
        }
        expect(normalizedLockedInput).toStrictEqual(FleetActionSelectionParity.lockedNormalizedInput)
        expect(normalizedLockedInput).toStrictEqual(normalizedSelectedView)
        expect(lockedEvaluation.status).toBe("ELIGIBLE")
        expect(lockedEvaluation.resourceCommitments).toStrictEqual({
          [ResourceType.INFLUENCE]: 6,
          [ResourceType.METAL]: 0,
          [ResourceType.FUEL]: 4,
          [ResourceType.ENERGY]: 0,
          [ResourceType.COLONY]: 0,
        })

        return lockedInput
      })
      expect(await turnProcessor.processNextDueTurn()).toBe("processed")
      expect(lockedInputObserver).toHaveBeenCalledTimes(1)
    })

    integrationTest("should preserve the composed Move and Attack Move parity through the public API and worker", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(ComposedReservationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: ComposedReservationRuleset.id,
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

      const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const moveAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_1")
      const attackAction = playerView.actions.find(({ id }) => id === AttackMoveTest.id + "_1")
      const extraMoveAction = playerView.actions.find(({ id }) => id === "MOVE_FLEET_STANDARD_2")
      const extraAttackAction = playerView.actions.find(({ id }) => id === AttackMoveTest.id + "_2")
      const buildAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(moveAction)
      Assert.isDefined(attackAction)
      Assert.isDefined(extraMoveAction)
      Assert.isDefined(extraAttackAction)
      Assert.isDefined(buildAction)
      expect(sourceFleet.strength).toBe(50)
      expect(playerView.resources[ResourceType.INFLUENCE].total).toBe(8)
      expect(playerView.resources[ResourceType.METAL].total).toBe(5)
      expect(playerView.resources[ResourceType.FUEL].total).toBe(2)

      const evaluatePublicView = (
        view: typeof playerView,
      ): {
        state: EligibilityState
        submissions: Array<ReturnType<typeof createSubmittedActionStub>>
        evaluation: ReturnType<typeof evaluateSubmittedActions>
      } => {
        const actions = view.actions.map((action) =>
          action.selectedTargets === null
            ? createAvailableActionStub({
                id: action.id,
                playerId: view.player.id,
                actionDefinitionId: action.actionDefinitionId,
              })
            : createSubmittedActionStub({
                id: action.id,
                playerId: view.player.id,
                actionDefinitionId: action.actionDefinitionId,
                selectedTargets: action.selectedTargets,
                selectedInputs: action.selectedInputs ?? {},
              }),
        )
        const state: EligibilityState = {
          gameId: view.gameId,
          turn: view.turn,
          submittingPlayerId: view.player.id,
          resources: createResourcesStub({
            [ResourceType.INFLUENCE]: view.resources[ResourceType.INFLUENCE].total,
            [ResourceType.METAL]: view.resources[ResourceType.METAL].total,
            [ResourceType.FUEL]: view.resources[ResourceType.FUEL].total,
            [ResourceType.ENERGY]: view.resources[ResourceType.ENERGY].total,
            [ResourceType.COLONY]: view.resources[ResourceType.COLONY].total,
          }),
          players: indexBy("id", [{ id: view.player.id, ownerPlayerId: view.player.id }]),
          planets: indexBy(
            "id",
            view.galaxy.systems.flatMap(({ planets: systemPlanets }) =>
              systemPlanets.map(({ id, ownerPlayerId, x, y }) => ({ id, ownerPlayerId, x, y })),
            ),
          ),
          fleets: indexBy(
            "id",
            view.fleets.map(({ id, name, ownerPlayerId, originPlanetId, strength }) =>
              createFleetStub({ id, name, ownerPlayerId, originPlanetId, strength }),
            ),
          ),
          actions,
        }
        const submissions = actions.flatMap((action) => (action.selectedTargets === null ? [] : [action]))
        return {
          state,
          submissions,
          evaluation: evaluateSubmittedActions({ state, ruleset: ComposedReservationRuleset, submissions }),
        }
      }

      const submitSelection = async (actionId: string, strength: number): Promise<void> => {
        await player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: playerView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength },
          }),
        })
      }
      await submitSelection(moveAction.id, 20)
      await submitSelection(attackAction.id, 30)
      const selectedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(selectedView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 20 },
      })
      expect(selectedView.actions.find(({ id }) => id === attackAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 30 },
      })
      expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 0 })
      expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 0 })
      const selectedEvaluation = evaluatePublicView(selectedView)
      expect({
        status: selectedEvaluation.evaluation.status,
        issues: selectedEvaluation.evaluation.issues,
        strengthCommitment: selectedEvaluation.evaluation.strengthCommitments[sourceFleet.id],
        remainingStrength: selectedEvaluation.evaluation.remainingStrength[sourceFleet.id],
        resourceCommitments: selectedEvaluation.evaluation.resourceCommitments,
      }).toStrictEqual({
        status: "ELIGIBLE",
        issues: [],
        strengthCommitment: 50,
        remainingStrength: 0,
        resourceCommitments: {
          [ResourceType.INFLUENCE]: 8,
          [ResourceType.METAL]: 0,
          [ResourceType.FUEL]: 2,
          [ResourceType.ENERGY]: 0,
          [ResourceType.COLONY]: 0,
        },
      })

      const partialCandidate = evaluateTargetCandidate({
        state: selectedEvaluation.state,
        ruleset: ComposedReservationRuleset,
        draft: { actionId: extraAttackAction.id, selectedTargets: {}, selectedInputs: {} },
        targetTag: branded<TargetTag>("fleet"),
        targetId: sourceFleet.id,
      })
      expect({
        status: partialCandidate.status,
        candidateStatus: partialCandidate.candidateStatus,
        candidateIssues: partialCandidate.candidateIssues.map(({ code }) => code),
        missingTargets: partialCandidate.missingTargets,
        missingInputs: partialCandidate.missingInputs,
        strengthCommitment: partialCandidate.strengthCommitments[sourceFleet.id],
        remainingStrength: partialCandidate.remainingStrength[sourceFleet.id],
        resourceCommitments: partialCandidate.resourceCommitments,
      }).toStrictEqual({
        status: "INELIGIBLE",
        candidateStatus: "INELIGIBLE",
        candidateIssues: ["INSUFFICIENT_STRENGTH"],
        missingTargets: [branded<TargetTag>("planet")],
        missingInputs: [branded("strength")],
        strengthCommitment: 50,
        remainingStrength: 0,
        resourceCommitments: {
          [ResourceType.INFLUENCE]: 13,
          [ResourceType.METAL]: 0,
          [ResourceType.FUEL]: 3,
          [ResourceType.ENERGY]: 0,
          [ResourceType.COLONY]: 0,
        },
      })

      const beforeRejectedDrafts = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: selectedView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: attackAction.id,
            selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
            selectedInputs: { strength: 31 },
          }),
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(
        player.client.gameplay.updateActionSubmission.mutate({
          gameId: createdGameId,
          turn: selectedView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: buildAction.id,
            selectedTargets: { planet: origin.id },
            selectedInputs: {},
          }),
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeRejectedDrafts)

      await submitSelection(moveAction.id, 19)
      const editedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const editedEvaluation = evaluatePublicView(editedView).evaluation
      expect(editedEvaluation.status).toBe("ELIGIBLE")
      expect(editedEvaluation.strengthCommitments[sourceFleet.id]).toBe(49)
      expect(editedEvaluation.remainingStrength[sourceFleet.id]).toBe(1)
      expect(editedEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(8)
      expect(editedEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(2)

      const resourceAttempt = createSubmittedActionStub({
        id: extraMoveAction.id,
        playerId: editedView.player.id,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 1 },
      })
      const editedProjection = evaluatePublicView(editedView)
      const resourceAttemptEvaluation = evaluateSubmittedActions({
        state: editedProjection.state,
        ruleset: ComposedReservationRuleset,
        submissions: [...editedProjection.submissions, resourceAttempt],
      })
      expect(resourceAttemptEvaluation.status).toBe("INELIGIBLE")
      expect(resourceAttemptEvaluation.strengthCommitments[sourceFleet.id]).toBe(50)
      expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(11)
      expect(resourceAttemptEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(3)
      expect(resourceAttemptEvaluation.issues).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.INFLUENCE }),
          expect.objectContaining({ code: "INSUFFICIENT_RESOURCES", resourceType: ResourceType.FUEL }),
        ]),
      )
      const beforeResourceRejection = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const exhaustedResourcesSubmission = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: editedView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: extraMoveAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 1 },
        }),
      })
      await expect(exhaustedResourcesSubmission).rejects.toThrow("Missing 3 INFLUENCE\nMissing 1 FUEL")
      await expect(exhaustedResourcesSubmission).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeResourceRejection)

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: editedView.turn,
        submittedActionTargets: { actionId: moveAction.id, selectedTargets: null, selectedInputs: null },
      })
      const canceledView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      const canceledEvaluation = evaluatePublicView(canceledView).evaluation
      expect(canceledView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({ selectedTargets: null, selectedInputs: null })
      expect(canceledView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 8, uncommitted: 3 })
      expect(canceledView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })
      expect(canceledEvaluation.status).toBe("ELIGIBLE")
      expect(canceledEvaluation.strengthCommitments[sourceFleet.id]).toBe(30)
      expect(canceledEvaluation.remainingStrength[sourceFleet.id]).toBe(20)
      expect(canceledEvaluation.resourceCommitments[ResourceType.INFLUENCE]).toBe(5)
      expect(canceledEvaluation.resourceCommitments[ResourceType.FUEL]).toBe(1)

      await submitSelection(moveAction.id, 20)
      const restoredPair = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(restoredPair.resources[ResourceType.INFLUENCE].uncommitted).toBe(0)
      expect(restoredPair.resources[ResourceType.FUEL].uncommitted).toBe(0)

      // Assert
      await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
      const afterWorkerDeparture = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(afterWorkerDeparture.fleets.map(({ strength }) => strength).toSorted((first, second) => first - second)).toStrictEqual([
        20, 30,
      ])
      expect(afterWorkerDeparture.fleets.some(({ id }) => id === sourceFleet.id)).toBe(false)
      expect(afterWorkerDeparture.fleets.every(({ movement }) => movement !== undefined)).toBe(true)
      expect(afterWorkerDeparture.resources[ResourceType.INFLUENCE].total).toBe(0)
      expect(afterWorkerDeparture.resources[ResourceType.FUEL].total).toBe(0)
      expect(afterWorkerDeparture.actions.find(({ id }) => id === moveAction.id)?.isInProgress).toBe(true)
      expect(afterWorkerDeparture.actions.find(({ id }) => id === attackAction.id)?.isInProgress).toBe(true)
    })

    integrationTest("should not count a selected same-turn Influence gain toward an Attack Move", async ({ db }) => {
      // Arrange
      const clock = new ControlledClock()
      const apiServices = await createApiStub({ db, clock })
      Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(ComposedGainReservationRuleset))
      using apiServer = new ApiServer(apiServices)
      const player = await apiServer.createClient({ authenticated: true })
      const { createdGameId } = await player.client.games.create.mutate({
        configuration: createGameConfigurationStub({
          rulesetId: ComposedGainReservationRuleset.id,
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

      const sourceFleet = playerView.fleets.find(({ originPlanetId }) => originPlanetId === origin.id)
      const gainAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === GainInfluence.id)
      const moveAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetStandard.id)
      const attackAction = playerView.actions.find(({ actionDefinitionId }) => actionDefinitionId === AttackMoveTest.id)
      Assert.isDefined(sourceFleet)
      Assert.isDefined(gainAction)
      Assert.isDefined(moveAction)
      Assert.isDefined(attackAction)
      expect(sourceFleet.strength).toBe(50)
      expect(playerView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 7, uncommitted: 7 })
      expect(playerView.resources[ResourceType.METAL].total).toBe(5)
      expect(playerView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 2 })

      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: gainAction.id,
          selectedTargets: {},
          selectedInputs: {},
        }),
      })
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: playerView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: moveAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 20 },
        }),
      })
      const gainAndMoveView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
      expect(gainAndMoveView.actions.find(({ id }) => id === gainAction.id)).toMatchObject({ selectedTargets: {}, selectedInputs: {} })
      expect(gainAndMoveView.actions.find(({ id }) => id === moveAction.id)).toMatchObject({
        selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
        selectedInputs: { strength: 20 },
      })
      expect(gainAndMoveView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 7, uncommitted: 4 })
      expect(gainAndMoveView.resources[ResourceType.FUEL]).toStrictEqual({ total: 2, uncommitted: 1 })

      // Assert
      const attackAfterGainAndMove = player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: gainAndMoveView.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: attackAction.id,
          selectedTargets: { fleet: sourceFleet.id, planet: destination.id },
          selectedInputs: { strength: 30 },
        }),
      })
      await expect(attackAfterGainAndMove).rejects.toThrow("Missing 1 INFLUENCE")
      await expect(attackAfterGainAndMove).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(gainAndMoveView)
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
            pendingArrivalEffects: [],
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

    integrationTest(
      "should honor renamed Assault tags and reject invalid public Fleet selections",
      async ({ db }) => {
        // Public game setup, repeated worker turns, and full readbacks can exceed 15 seconds under combined coverage.
        // Arrange: create the foreign-game Fleet through public actions and the production worker.
        const clock = new ControlledClock()
        const apiServices = await createApiStub({ db, clock })
        Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(RenamedComposedAssaultRuleset))
        using apiServer = new ApiServer(apiServices)
        const alice = await apiServer.createClient({ authenticated: true })
        const bob = await apiServer.createClient({ authenticated: true })
        const { turnProcessor } = await createTurnProcessorStub({ db, clock })
        const processReadyTurn = async (gameId: number, turn: number, clients: ReadonlyArray<typeof alice>): Promise<void> => {
          await Promise.all(
            clients.map(async ({ client }) => await client.gameplay.updateReadiness.mutate({ gameId, turn, isReady: true })),
          )
          expect(await turnProcessor.processNextDueTurn()).toBe("processed")
        }

        const { createdGameId: foreignGameId } = await alice.client.games.create.mutate({
          configuration: createGameConfigurationStub({ rulesetId: RenamedComposedAssaultRuleset.id, nbSeats: 1, mapGenerationSeed: 147 }),
        })
        await alice.client.games.startGame.mutate({ gameId: foreignGameId })
        const foreignView = await alice.client.gameplay.getPlayerView.query({ gameId: foreignGameId })
        const foreignHome = foreignView.galaxy.systems
          .flatMap(({ planets }) => planets)
          .find(({ ownerPlayerId }) => ownerPlayerId === foreignView.player.id)
        const foreignBuild = foreignView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
        Assert.isDefined(foreignHome)
        Assert.isDefined(foreignBuild)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId: foreignGameId,
          turn: foreignView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: foreignBuild.id,
            selectedTargets: { planet: foreignHome.id },
            selectedInputs: {},
          }),
        })
        await processReadyTurn(foreignGameId, foreignView.turn, [alice])
        const foreignBuiltView = await alice.client.gameplay.getPlayerView.query({ gameId: foreignGameId })
        const foreignFleet = foreignBuiltView.fleets.find(({ originPlanetId }) => originPlanetId === foreignHome.id)
        Assert.isDefined(foreignFleet)
        expect(foreignFleet.strength).toBe(10)

        // Arrange: create the fixed seed-147 two-owner route and build the 50/20 fleets publicly.
        const { createdGameId: gameId } = await alice.client.games.create.mutate({
          configuration: createGameConfigurationStub({
            rulesetId: RenamedComposedAssaultRuleset.id,
            nbSeats: 2,
            mapGenerationSeed: 147,
          }),
        })
        await bob.client.games.join.mutate({ gameId })
        await alice.client.games.startGame.mutate({ gameId })
        let aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
        let bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        const planets = aliceView.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
        const aliceHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === aliceView.player.id)
        const bobHome = planets.find(({ ownerPlayerId }) => ownerPlayerId === bobView.player.id)
        Assert.isDefined(aliceHome)
        Assert.isDefined(bobHome)
        expect([aliceHome.coordinates, bobHome.coordinates].toSorted()).toStrictEqual(["44:98:05", "45:83:40"])
        expect(Math.hypot(bobHome.x - aliceHome.x, bobHome.y - aliceHome.y)).toBe(4.418312565270031)

        for (let buildRound = 1; buildRound <= 5; buildRound += 1) {
          aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
          const aliceBuild = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
          Assert.isDefined(aliceBuild)
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: aliceView.turn,
            submittedActionTargets: createSubmittedActionTargetsDtoStub({
              actionId: aliceBuild.id,
              selectedTargets: { planet: aliceHome.id },
              selectedInputs: {},
            }),
          })
          if (buildRound <= 2) {
            bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
            const bobBuild = bobView.actions.find(({ actionDefinitionId }) => actionDefinitionId === BuildFleetStandard.id)
            Assert.isDefined(bobBuild)
            await bob.client.gameplay.updateActionSubmission.mutate({
              gameId,
              turn: bobView.turn,
              submittedActionTargets: createSubmittedActionTargetsDtoStub({
                actionId: bobBuild.id,
                selectedTargets: { planet: bobHome.id },
                selectedInputs: {},
              }),
            })
          } else {
            bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
          }
          await processReadyTurn(gameId, aliceView.turn, [alice, bob])
        }

        aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
        bobView = await bob.client.gameplay.getPlayerView.query({ gameId })
        const source = aliceView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === aliceView.player.id && originPlanetId === aliceHome.id && movement === undefined,
        )
        const defender = bobView.fleets.find(
          ({ ownerPlayerId, originPlanetId, movement }) =>
            ownerPlayerId === bobView.player.id && originPlanetId === bobHome.id && movement === undefined,
        )
        Assert.isDefined(source)
        Assert.isDefined(defender)
        expect(source.strength).toBe(50)
        expect(defender.strength).toBe(20)

        // Act & Assert: the standalone definition is a legal no-op at its own source when no enemy is present.
        const stationaryAssault = aliceView.actions.find(({ actionDefinitionId }) => actionDefinitionId === StationaryAssaultTest.id)
        Assert.isDefined(stationaryAssault)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: aliceView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: stationaryAssault.id,
            selectedTargets: { station: source.id, battlePlanet: aliceHome.id },
            selectedInputs: {},
          }),
        })
        await processReadyTurn(gameId, aliceView.turn, [alice, bob])
        aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
        expect(
          aliceView.fleets
            .map(({ id, name, ownerPlayerId, originPlanetId, strength, movement }) => ({
              id,
              name,
              ownerPlayerId,
              originPlanetId,
              strength,
              movement,
            }))
            .toSorted((left, right) => left.id.localeCompare(right.id)),
        ).toStrictEqual(
          [source, defender]
            .map(({ id, name, ownerPlayerId, originPlanetId, strength, movement }) => ({
              id,
              name,
              ownerPlayerId,
              originPlanetId,
              strength,
              movement,
            }))
            .toSorted((left, right) => left.id.localeCompare(right.id)),
        )

        // Arrange: create a genuinely moving source with an ordinary public Move and worker turn.
        const movingView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const movingDestination = planets
          .filter(({ ownerPlayerId, id }) => ownerPlayerId === null && id !== aliceHome.id)
          .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
          .filter(({ distance }) => distance > 4 && distance <= 10)
          .toSorted((left, right) => left.distance - right.distance)[0]
        const moveAction = movingView.actions.find(({ actionDefinitionId }) => actionDefinitionId === MoveFleetImproved.id)
        Assert.isDefined(movingDestination)
        Assert.isDefined(moveAction)
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: movingView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: moveAction.id,
            selectedTargets: { fleet: source.id, planet: movingDestination.planet.id },
            selectedInputs: { strength: 1 },
          }),
        })
        await processReadyTurn(gameId, movingView.turn, [alice, bob])
        aliceView = await alice.client.gameplay.getPlayerView.query({ gameId })
        const movingSource = aliceView.fleets.find(({ movement }) => movement?.submission.id === moveAction.id)
        const currentSource = aliceView.fleets.find(({ id }) => id === source.id)
        Assert.isDefined(movingSource)
        Assert.isDefined(currentSource)
        expect(movingSource).toMatchObject({
          strength: 1,
          distanceToEnd: movingDestination.distance - 1,
          destinationPlanetId: movingDestination.planet.id,
          movement: { speed: 1 },
        })
        expect(currentSource.strength).toBe(49)

        const customAction = aliceView.actions.find(({ id }) => id === `${RenamedComposedAssault.id}_1`)
        Assert.isDefined(customAction)
        const rejectDraftWithoutMutation = async (
          selectedTargets: Record<string, string>,
          selectedInputs: Record<string, number>,
        ): Promise<void> => {
          const beforeRejectedDraft = await alice.client.gameplay.getPlayerView.query({ gameId })
          const submittedActionTargets = createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets,
            selectedInputs: { units: 1 },
          })
          Object.defineProperty(submittedActionTargets, "selectedInputs", { value: selectedInputs, enumerable: true })
          await expect(
            alice.client.gameplay.updateActionSubmission.mutate({
              gameId,
              turn: beforeRejectedDraft.turn,
              submittedActionTargets,
            }),
          ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
          expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(beforeRejectedDraft)
        }
        const validTargets = { originForce: source.id, landingSite: bobHome.id }
        await rejectDraftWithoutMutation(validTargets, {})
        await rejectDraftWithoutMutation(validTargets, { units: 0 })
        await rejectDraftWithoutMutation(validTargets, { units: 1.5 })
        await rejectDraftWithoutMutation({ originForce: defender.id, landingSite: aliceHome.id }, { units: 1 })
        await rejectDraftWithoutMutation({ originForce: movingSource.id, landingSite: bobHome.id }, { units: 1 })
        await rejectDraftWithoutMutation({ originForce: foreignFleet.id, landingSite: bobHome.id }, { units: 1 })
        const distantPlanet = planets
          .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
          .filter(({ distance }) => distance > 5)
          .toSorted((left, right) => right.distance - left.distance)[0]
        Assert.isDefined(distantPlanet)
        await rejectDraftWithoutMutation({ originForce: source.id, landingSite: distantPlanet.planet.id }, { units: 1 })

        // Act: submit the renamed, two-instance action through the public API and resolve it with the real worker.
        await alice.client.gameplay.updateActionSubmission.mutate({
          gameId,
          turn: aliceView.turn,
          submittedActionTargets: createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets: validTargets,
            selectedInputs: { units: 30 },
          }),
        })
        const selectedView = await alice.client.gameplay.getPlayerView.query({ gameId })
        expect(selectedView.actions.find(({ id }) => id === customAction.id)).toMatchObject({
          actionDefinitionId: RenamedComposedAssault.id,
          selectedTargets: validTargets,
          selectedInputs: { units: 30 },
        })
        expect(selectedView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 87, uncommitted: 80 })
        expect(selectedView.resources[ResourceType.FUEL]).toStrictEqual({ total: 97, uncommitted: 95 })

        await processReadyTurn(gameId, selectedView.turn, [alice, bob])
        const firstReload = await alice.client.gameplay.getPlayerView.query({ gameId })
        const journey = firstReload.fleets.find(({ movement }) => movement?.submission.id === customAction.id)
        const remainder = firstReload.fleets.find(({ id }) => id === source.id)
        Assert.isDefined(journey)
        Assert.isDefined(remainder)
        expect(journey).toMatchObject({
          strength: 30,
          distanceToEnd: 2.418312565270031,
          destinationPlanetId: bobHome.id,
          movement: {
            speed: 2,
            submission: {
              id: customAction.id,
              actionDefinitionId: RenamedComposedAssault.id,
              selectedTargets: validTargets,
              selectedInputs: { units: 30 },
            },
            pendingArrivalEffects: [
              {
                definitionOrdinal: 3,
                effectDefinition: {
                  type: "FLEET_ASSAULT",
                  targets: {
                    fleet: { actionTargetTag: "originForce" },
                    planet: { actionTargetTag: "landingSite" },
                  },
                },
              },
            ],
          },
        })
        expect(remainder).toMatchObject({ id: source.id, name: source.name, strength: 19, originPlanetId: aliceHome.id })
        expect(firstReload.fleets.find(({ id }) => id === defender.id)?.strength).toBe(20)
        expect(firstReload.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
        expect(firstReload.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })

        // The composed action remains locked while its captured selection travels. Verify the same edits
        // would be valid through the free second instance, then prove each rejected API attempt preserves
        // the exact public view, saved journey, selections, and resources.
        const freeComposedAction = firstReload.actions.find(({ id }) => id === `${RenamedComposedAssault.id}_2`)
        const occupiedComposedAction = firstReload.actions.find(({ id }) => id === customAction.id)
        const occupiedJourney = firstReload.fleets.find(({ id }) => id === journey.id)
        Assert.isDefined(freeComposedAction)
        Assert.isDefined(occupiedComposedAction)
        Assert.isDefined(occupiedJourney)
        expect(freeComposedAction.isInProgress).toBe(false)
        expect(occupiedComposedAction.isInProgress).toBe(true)
        expect(occupiedJourney.movement?.submission).toStrictEqual({
          id: customAction.id,
          playerId: aliceView.player.id,
          actionDefinitionId: RenamedComposedAssault.id,
          selectedTargets: validTargets,
          selectedInputs: { units: 30 },
        })

        const redirectPlanet = planets
          .filter(({ id }) => id !== aliceHome.id && id !== bobHome.id)
          .map((planet) => ({ planet, distance: Math.hypot(planet.x - aliceHome.x, planet.y - aliceHome.y) }))
          .filter(({ distance }) => distance <= 5)
          .toSorted((left, right) => left.distance - right.distance)[0]
        Assert.isDefined(redirectPlanet)
        const redirectedTargets = { originForce: source.id, landingSite: redirectPlanet.planet.id }

        const proveFreeInstanceSelectionAndCancel = async (selectedTargets: Record<string, string>, units: number): Promise<void> => {
          expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: firstReload.turn,
            submittedActionTargets: createSubmittedActionTargetsDtoStub({
              actionId: freeComposedAction.id,
              selectedTargets,
              selectedInputs: { units },
            }),
          })
          const freeSelectionView = await alice.client.gameplay.getPlayerView.query({ gameId })
          expect(freeSelectionView.actions.find(({ id }) => id === freeComposedAction.id)).toMatchObject({
            selectedTargets,
            selectedInputs: { units },
            isInProgress: false,
          })
          expect(freeSelectionView.actions.find(({ id }) => id === customAction.id)).toStrictEqual(occupiedComposedAction)
          expect(freeSelectionView.fleets.find(({ id }) => id === journey.id)).toStrictEqual(occupiedJourney)
          expect(freeSelectionView.resources[ResourceType.INFLUENCE]).toStrictEqual({
            total: firstReload.resources[ResourceType.INFLUENCE].total,
            uncommitted: firstReload.resources[ResourceType.INFLUENCE].uncommitted - 7,
          })
          expect(freeSelectionView.resources[ResourceType.FUEL]).toStrictEqual({
            total: firstReload.resources[ResourceType.FUEL].total,
            uncommitted: firstReload.resources[ResourceType.FUEL].uncommitted - 2,
          })
          await alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: firstReload.turn,
            submittedActionTargets: { actionId: freeComposedAction.id, selectedTargets: null, selectedInputs: null },
          })
          expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
        }

        await proveFreeInstanceSelectionAndCancel(validTargets, 1)
        await proveFreeInstanceSelectionAndCancel(redirectedTargets, 1)
        await proveFreeInstanceSelectionAndCancel(validTargets, 19)

        const rejectOccupiedAttemptWithoutMutation = async (
          submittedActionTargets: ReturnType<typeof createSubmittedActionTargetsDtoStub>,
          expectedMessage: string,
        ): Promise<void> => {
          expect(await alice.client.gameplay.getPlayerView.query({ gameId })).toStrictEqual(firstReload)
          const updatePromise = alice.client.gameplay.updateActionSubmission.mutate({
            gameId,
            turn: firstReload.turn,
            submittedActionTargets,
          })
          await expect(updatePromise).rejects.toThrow(expectedMessage)
          await expect(updatePromise).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
          const unchangedView = await alice.client.gameplay.getPlayerView.query({ gameId })
          expect(unchangedView).toStrictEqual(firstReload)
          expect(unchangedView.actions.find(({ id }) => id === customAction.id)).toStrictEqual(occupiedComposedAction)
          expect(unchangedView.resources).toStrictEqual(firstReload.resources)
          expect(unchangedView.fleets.find(({ id }) => id === journey.id)).toStrictEqual(occupiedJourney)
        }
        const occupiedMessage = `Action instance "${customAction.id}" is still in progress with Fleet "${journey.id}"`
        await rejectOccupiedAttemptWithoutMutation(
          createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets: validTargets,
            selectedInputs: { units: 1 },
          }),
          occupiedMessage,
        )
        await rejectOccupiedAttemptWithoutMutation(
          createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets: validTargets,
            selectedInputs: { units: 19 },
          }),
          occupiedMessage,
        )
        await rejectOccupiedAttemptWithoutMutation(
          createSubmittedActionTargetsDtoStub({
            actionId: customAction.id,
            selectedTargets: redirectedTargets,
            selectedInputs: { units: 1 },
          }),
          occupiedMessage,
        )
        await rejectOccupiedAttemptWithoutMutation(
          { actionId: customAction.id, selectedTargets: null, selectedInputs: null },
          "Cannot cancel an Action while it is in progress",
        )

        await processReadyTurn(gameId, firstReload.turn, [alice, bob])
        const secondReload = await alice.client.gameplay.getPlayerView.query({ gameId })
        expect(secondReload.fleets.find(({ id }) => id === journey.id)?.distanceToEnd).toBe(0.418312565270031)
        expect(secondReload.fleets.find(({ id }) => id === defender.id)?.strength).toBe(20)
        expect(secondReload.resources[ResourceType.INFLUENCE].total).toBe(80)
        expect(secondReload.resources[ResourceType.FUEL].total).toBe(95)

        await processReadyTurn(gameId, secondReload.turn, [alice, bob])
        const arrivalView = await alice.client.gameplay.getPlayerView.query({ gameId })
        expect(arrivalView.fleets.find(({ id }) => id === defender.id)).toBeUndefined()
        expect(arrivalView.fleets.find(({ id }) => id === journey.id)).toStrictEqual({
          id: journey.id,
          name: journey.name,
          ownerPlayerId: aliceView.player.id,
          strength: 10,
          originPlanetId: bobHome.id,
        })
        expect(arrivalView.fleets.find(({ id }) => id === source.id)).toMatchObject({
          id: source.id,
          name: source.name,
          strength: 19,
          originPlanetId: aliceHome.id,
        })
        expect(arrivalView.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 80, uncommitted: 80 })
        expect(arrivalView.resources[ResourceType.FUEL]).toStrictEqual({ total: 95, uncommitted: 95 })
        expect(arrivalView.actions.find(({ id }) => id === customAction.id)?.isInProgress).toBe(false)
      },
      30_000,
    )

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

const ComposedReservationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_reservation_parity",
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "MOVE_FLEET_STANDARD_2", actionDefinitionId: MoveFleetStandard.id },
    { id: AttackMoveTest.id + "_2", actionDefinitionId: AttackMoveTest.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 18,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

const ComposedGainReservationRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_composed_gain_reservation",
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 17,
    [ResourceType.METAL]: 10,
    [ResourceType.FUEL]: 2,
  },
})

const FleetActionParityRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_fleet_action_selection_parity",
  actionPool: FleetActionSelectionParityActionPool,
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

const RenamedComposedAssault = typedParse(ActionDefinitionSchema, {
  ...AttackMoveTest,
  id: "TEST_RENAMED_COMPOSED_ASSAULT",
  name: "Flexible Landing Assault",
  tier: "EXCEPTIONAL",
  inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
  targets: {
    originForce: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    landingSite: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" }),
  ],
})

const RenamedComposedAssaultRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_renamed_composed_assault_api",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [RenamedComposedAssault.id]: RenamedComposedAssault },
  actionPool: [
    ...TestRuleset.actionPool,
    { id: `${RenamedComposedAssault.id}_1`, actionDefinitionId: RenamedComposedAssault.id },
    { id: `${RenamedComposedAssault.id}_2`, actionDefinitionId: RenamedComposedAssault.id },
  ],
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

describe("Colonize API boundary", () => {
  integrationTest("should reject strength19 and Influence24 without mutation, then accept strength20 at Influence25", async ({ db }) => {
    // Arrange
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    const buildHundred = typedParse(ActionDefinitionSchema, {
      ...BuildFleetStandard,
      id: "FIXTURE_API_BUILD_FLEET_100",
      name: "Fixture API Build Fleet 100",
      costs: [],
      effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 100 })],
    })
    const gainOneInfluence = typedParse(ActionDefinitionSchema, {
      ...GainInfluence,
      id: "FIXTURE_API_GAIN_INFLUENCE_ONE",
      name: "Fixture API Gain One Influence",
      effects: [ResourceGainEffectDefinition.create({ quantity: 1, resourceType: ResourceType.INFLUENCE })],
    })
    const ruleset = Ruleset.create({
      ...TestRuleset,
      id: "test_public_colonize_api_boundary",
      name: "Public Colonize API Boundary Fixture",
      actionDefinitions: indexBy("id", [...Object.values(TestRuleset.actionDefinitions), buildHundred, gainOneInfluence]),
      actionPool: [
        ...TestRuleset.actionPool,
        { id: "FIXTURE_API_BUILD_FLEET_100_1", actionDefinitionId: buildHundred.id },
        { id: "FIXTURE_API_GAIN_INFLUENCE_ONE_1", actionDefinitionId: gainOneInfluence.id },
      ],
      startingResources: {
        ...TestRuleset.startingResources,
        [ResourceType.INFLUENCE]: 24,
        [ResourceType.METAL]: 0,
        [ResourceType.FUEL]: 0,
        [ResourceType.COLONY]: 0,
      },
    })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(ruleset))
    using apiServer = new ApiServer(apiServices)
    const player = await apiServer.createClient({ authenticated: true })
    const { createdGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: ruleset.id,
        nbSeats: 1,
        mapGenerationSeed: 1234,
        turnIntervalSeconds: 10,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: createdGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
    const target = planets.find(({ coordinates }) => coordinates === "55:07:50")
    Assert.isDefined(home)
    Assert.isDefined(target)
    expect(target.ownerPlayerId).toBeNull()
    expect(Math.hypot(home.x - target.x, home.y - target.y)).toBeLessThanOrEqual(5)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    const buildAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === buildHundred.id)
    Assert.isDefined(buildAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: buildAction.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      }),
    })
    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const source = view.fleets.find(
      ({ ownerPlayerId, originPlanetId, movement }) =>
        ownerPlayerId === view.player.id && originPlanetId === home.id && movement === undefined,
    )
    Assert.isDefined(source)
    expect(source.strength).toBe(100)
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })

    // Act & Assert
    const colonizeAction = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === ColonizePlanetTest.id)
    Assert.isDefined(colonizeAction)
    const submitColonize = async (strength: number): Promise<void> => {
      await player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: view.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: colonizeAction.id,
          selectedTargets: { fleet: source.id, planet: target.id },
          selectedInputs: { strength },
        }),
      })
    }
    const beforeInsufficientInfluence = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    await expect(submitColonize(20)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    const afterInsufficientInfluence = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(afterInsufficientInfluence).toStrictEqual(beforeInsufficientInfluence)
    expect(afterInsufficientInfluence.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 24, uncommitted: 24 })
    expect(afterInsufficientInfluence.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(afterInsufficientInfluence.fleets.find(({ id }) => id === source.id)).toMatchObject({
      id: source.id,
      strength: 100,
      originPlanetId: home.id,
    })
    expect(
      afterInsufficientInfluence.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId,
    ).toBeNull()

    const gainAction = afterInsufficientInfluence.actions.find(({ actionDefinitionId }) => actionDefinitionId === gainOneInfluence.id)
    Assert.isDefined(gainAction)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: afterInsufficientInfluence.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: gainAction.id,
        selectedTargets: {},
        selectedInputs: {},
      }),
    })
    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    const atTwentyFive = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    view = atTwentyFive
    expect(atTwentyFive.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 25 })
    expect(atTwentyFive.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })

    await expect(submitColonize(19)).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(atTwentyFive)
    expect(atTwentyFive.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 100 })
    expect(atTwentyFive.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()

    await submitColonize(20)
    const selected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(selected.actions.find(({ id }) => id === colonizeAction.id)).toMatchObject({
      selectedTargets: { fleet: source.id, planet: target.id },
      selectedInputs: { strength: 20 },
      isInProgress: false,
    })
    expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 25, uncommitted: 0 })
    expect(selected.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(selected.fleets.find(({ id }) => id === source.id)).toMatchObject({
      id: source.id,
      strength: 100,
      originPlanetId: home.id,
    })
    expect(selected.galaxy.systems.flatMap(({ planets }) => planets).find(({ id }) => id === target.id)?.ownerPlayerId).toBeNull()
  })
})

describe("Seed Outpost API boundary", () => {
  integrationTest("should reserve two public Seed Outpost instances and persist exact-threshold colonizations", async ({ db }) => {
    // Arrange: use public content, repositories, API routes, and the production worker.
    const clock = new ControlledClock()
    const apiServices = await createApiStub({ db, clock })
    Assert.isSuccess(await apiServices.rulesetsRepository.upsertRuleset(PublicSeedOutpostApiRuleset))
    using apiServer = new ApiServer(apiServices)
    const player = await apiServer.createClient({ authenticated: true })
    const { createdGameId } = await player.client.games.create.mutate({
      configuration: createGameConfigurationStub({
        rulesetId: PublicSeedOutpostApiRuleset.id,
        nbSeats: 1,
        mapGenerationSeed: 1234,
        turnIntervalSeconds: 10,
      }),
    })
    await player.client.games.startGame.mutate({ gameId: createdGameId })
    const { turnProcessor, turnsRepository } = await createTurnProcessorStub({ db, clock })
    let view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const planets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    const home = planets.find(({ ownerPlayerId }) => ownerPlayerId === view.player.id)
    Assert.isDefined(home)
    const routeCandidates = planets
      .filter(({ id, ownerPlayerId }) => id !== home.id && ownerPlayerId === null)
      .map((site) => ({ site, distance: Math.hypot(home.x - site.x, home.y - site.y) }))
      .toSorted((first, second) => {
        const distanceOrder = first.distance - second.distance
        return distanceOrder === 0 ? compareOrdinalStrings(first.site.coordinates, second.site.coordinates) : distanceOrder
      })
    const sites = routeCandidates.filter(({ distance }) => distance > 2 && distance <= 3).slice(0, 2)
    expect(sites.map(({ site, distance }) => ({ coordinates: site.coordinates, x: site.x, y: site.y, distance }))).toStrictEqual([
      { coordinates: "45:79:30", x: 59.794915548941574, y: 47.76114389615654, distance: 2.3005120328043422 },
      { coordinates: "45:79:25", x: 59.79537121117998, y: 47.76141021536587, distance: 2.300565677262062 },
    ])
    expect(sites).toHaveLength(2)
    const firstSite = sites[0]
    const secondSite = sites[1]
    Assert.isDefined(firstSite)
    Assert.isDefined(secondSite)
    expect(sites.every(({ site }) => site.ownerPlayerId === null)).toBe(true)

    const build = view.actions.find(({ actionDefinitionId }) => actionDefinitionId === PublicSeedOutpostBuildSixty.id)
    Assert.isDefined(build)
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: build.id,
        selectedTargets: { planet: home.id },
        selectedInputs: {},
      }),
    })
    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    const source = view.fleets.find(({ originPlanetId, movement }) => originPlanetId === home.id && movement === undefined)
    Assert.isDefined(source)
    expect(source.strength).toBe(60)

    const firstOutpost = view.actions.find(({ id }) => id === "TEST_SEED_OUTPOST_API_1")
    const secondOutpost = view.actions.find(({ id }) => id === "TEST_SEED_OUTPOST_API_2")
    Assert.isDefined(firstOutpost)
    Assert.isDefined(secondOutpost)
    expect([firstOutpost.actionDefinitionId, secondOutpost.actionDefinitionId]).toStrictEqual([SeedOutpostTest.id, SeedOutpostTest.id])

    const outOfRangeSite = planets.find(({ coordinates }) => coordinates === "54:18:10")
    Assert.isDefined(outOfRangeSite)
    const outOfRange = Math.hypot(home.x - outOfRangeSite.x, home.y - outOfRangeSite.y)
    expect(outOfRange).toBeCloseTo(10.129282735155494, 12)

    const beforeInvalidSelections = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: view.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: firstOutpost.id,
          selectedTargets: { force: source.id, site: firstSite.site.id },
          selectedInputs: { quota: 29 },
        }),
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: view.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: secondOutpost.id,
          selectedTargets: { force: source.id, site: outOfRangeSite.id },
          selectedInputs: { quota: 30 },
        }),
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeInvalidSelections)

    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: view.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 30 },
      }),
    })
    const firstSelected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(firstSelected.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 30 },
      isInProgress: false,
    })
    expect(firstSelected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
    expect(firstSelected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: firstSelected.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 35 },
      }),
    })
    const replaced = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(replaced.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 35 },
      isInProgress: false,
    })
    expect(replaced.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 43 })
    expect(replaced.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 8 })
    expect(replaced.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })

    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: replaced.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: null,
        selectedInputs: null,
      }),
    })
    const cancelled = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(cancelled.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
      selectedTargets: null,
      selectedInputs: null,
      isInProgress: false,
    })
    expect(cancelled.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 50 })
    expect(cancelled.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 10 })
    expect(cancelled.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 60 })

    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: cancelled.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: firstOutpost.id,
        selectedTargets: { force: source.id, site: firstSite.site.id },
        selectedInputs: { quota: 30 },
      }),
    })
    const firstReselected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    await player.client.gameplay.updateActionSubmission.mutate({
      gameId: createdGameId,
      turn: firstReselected.turn,
      submittedActionTargets: createSubmittedActionTargetsDtoStub({
        actionId: secondOutpost.id,
        selectedTargets: { force: source.id, site: secondSite.site.id },
        selectedInputs: { quota: 30 },
      }),
    })
    const selected = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(selected.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({
      selectedTargets: { force: source.id, site: firstSite.site.id },
      selectedInputs: { quota: 30 },
      isInProgress: false,
    })
    expect(selected.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({
      selectedTargets: { force: source.id, site: secondSite.site.id },
      selectedInputs: { quota: 30 },
      isInProgress: false,
    })
    expect(selected.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 50, uncommitted: 36 })
    expect(selected.resources[ResourceType.FUEL]).toStrictEqual({ total: 10, uncommitted: 6 })
    expect(selected.fleets.find(({ id }) => id === source.id)).toMatchObject({ id: source.id, strength: 60 })
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: selected.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: firstOutpost.id,
          selectedTargets: { force: source.id, site: firstSite.site.id },
          selectedInputs: { quota: 31 },
        }),
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(selected)

    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    const departed = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
    expect(departed.fleets.find(({ id }) => id === source.id)).toBeUndefined()
    const departedJourneys = departed.fleets
      .filter(({ destinationPlanetId }) => sites.some(({ site }) => site.id === destinationPlanetId))
      .map(({ destinationPlanetId, strength, distanceToEnd, movement }) => ({
        destinationPlanetId,
        strength,
        distanceToEnd,
        speed: movement?.speed,
      }))
      .toSorted((first, second) => (first.distanceToEnd ?? 0) - (second.distanceToEnd ?? 0))
    expect(departedJourneys).toStrictEqual([
      { destinationPlanetId: firstSite.site.id, strength: 30, distanceToEnd: 0.30051203280434224, speed: 2 },
      { destinationPlanetId: secondSite.site.id, strength: 30, distanceToEnd: 0.3005656772620622, speed: 2 },
    ])
    const departedJourneyIds = departedJourneys.map(
      ({ destinationPlanetId }) => departed.fleets.find(({ destinationPlanetId: targetId }) => targetId === destinationPlanetId)?.id,
    )
    expect(departedJourneyIds).toStrictEqual([expect.any(String), expect.any(String)])
    expect(
      departed.galaxy.systems
        .flatMap(({ planets: systemPlanets }) => systemPlanets)
        .filter(({ id }) => sites.some((entry) => entry.site.id === id))
        .map(({ ownerPlayerId }) => ownerPlayerId),
    ).toStrictEqual([null, null])
    expect(departed.actions.find(({ id }) => id === firstOutpost.id)?.isInProgress).toBe(true)
    expect(departed.actions.find(({ id }) => id === secondOutpost.id)?.isInProgress).toBe(true)
    expect(departed.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 36, uncommitted: 36 })
    expect(departed.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
    const beforeLockedEdit = departed
    await expect(
      player.client.gameplay.updateActionSubmission.mutate({
        gameId: createdGameId,
        turn: departed.turn,
        submittedActionTargets: createSubmittedActionTargetsDtoStub({
          actionId: firstOutpost.id,
          selectedTargets: { force: source.id, site: firstSite.site.id },
          selectedInputs: { quota: 30 },
        }),
      }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
    expect(await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })).toStrictEqual(beforeLockedEdit)

    await processNextRouterTurn({ clock, turnProcessor, turnsRepository })
    view = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })

    const persistedPlanets = view.galaxy.systems.flatMap(({ planets: systemPlanets }) => systemPlanets)
    for (const { site } of sites) {
      expect(persistedPlanets.find(({ id }) => id === site.id)?.ownerPlayerId).toBe(view.player.id)
      expect(
        view.fleets.some(({ originPlanetId, destinationPlanetId }) => originPlanetId === site.id || destinationPlanetId === site.id),
      ).toBe(false)
    }
    expect(view.fleets.some(({ id }) => departedJourneyIds.includes(id))).toBe(false)
    expect(view.fleets.find(({ id }) => id === source.id)).toBeUndefined()
    expect(view.resources[ResourceType.INFLUENCE]).toStrictEqual({ total: 36, uncommitted: 36 })
    expect(view.resources[ResourceType.FUEL]).toStrictEqual({ total: 6, uncommitted: 6 })
    expect(view.resources[ResourceType.COLONY]).toStrictEqual({ total: 0, uncommitted: 0 })
    expect(view.actions.find(({ id }) => id === firstOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
    expect(view.actions.find(({ id }) => id === secondOutpost.id)).toMatchObject({ selectedTargets: null, isInProgress: false })
  })
})

const PublicSeedOutpostBuildSixty = typedParse(ActionDefinitionSchema, {
  ...BuildFleetStandard,
  id: "FIXTURE_API_BUILD_FLEET_SIXTY",
  name: "Fixture API Build Fleet Sixty",
  costs: [],
  effects: [FleetBuildEffectDefinition.create({ planetTag: "planet", strength: 60 })],
})

const PublicSeedOutpostApiRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_public_seed_outpost_api_boundary",
  actionDefinitions: {
    ...TestRuleset.actionDefinitions,
    [SeedOutpostTest.id]: SeedOutpostTest,
    [PublicSeedOutpostBuildSixty.id]: PublicSeedOutpostBuildSixty,
  },
  actionPool: [
    ...TestRuleset.actionPool,
    { id: "TEST_SEED_OUTPOST_API_1", actionDefinitionId: SeedOutpostTest.id },
    { id: "TEST_SEED_OUTPOST_API_2", actionDefinitionId: SeedOutpostTest.id },
    { id: "FIXTURE_API_BUILD_FLEET_SIXTY_1", actionDefinitionId: PublicSeedOutpostBuildSixty.id },
  ],
  startingResources: {
    ...TestRuleset.startingResources,
    [ResourceType.INFLUENCE]: 50,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 10,
    [ResourceType.COLONY]: 0,
  },
})
