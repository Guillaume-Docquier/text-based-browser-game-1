import { Assert, branded, indexBy, Time, UnitOfTime } from "@guillaume-docquier/tools-ts"
import type { PositiveNumber } from "@guillaume-docquier/tools-ts/schemas"
import { evaluateSubmittedActions, type EligibilityState } from "shared/action-submission/evaluateActionSelection.ts"
import { compareOrdinalStrings } from "shared/domain/compareOrdinalStrings.ts"
import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { NonNegativeSafeInteger } from "shared/domain/NonNegativeSafeInteger.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { ActionDefinitionId } from "shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { InputTag } from "shared/domain/ruleset/action-definitions/InputTag.ts"
import type { PositiveInteger } from "shared/domain/ruleset/action-definitions/PositiveInteger.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { EffectDefinitionTargetDefinition } from "shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "shared/domain/turns/actions/ActionId.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { describe, expect, vi } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createSubmittedActionTargetsDtoStub } from "#api/gameplay/SubmittedActionTargetsDto.stub.ts"
import type { Fleet, Action, Planet, PlayerView } from "#api/types.ts"
import { ControlledClock } from "#lib/ControlledClock.ts"
import { BuildFleetStandard } from "#lib/rulesets/standard/action-definitions/build-fleet.ts"
import type { AuthenticatedApiClient } from "#tests/ApiClient.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"
import type { TurnsRepository, TurnToProcessModel } from "#turn-processing/turns.repository.ts"
import { assertBeforeRejectedDrafts, assertCanceledView } from "../../tests/fleet-assertions/gameplay.router.composed-parity-2.ts"
import {
  assertOutOfRangeSubmission,
  assertAfterFullForceCancel,
  assertImprovedRangeView,
  assertNormalizedInput,
  assertSelectedView,
} from "../../tests/fleet-assertions/gameplay.router.composed-parity.ts"
import { ComposedReservationRuleset, FleetActionParityRuleset, processNextRouterTurn } from "../../tests/fleet-gameplay/gameplay.router.ts"

describe("gameplay.router", () => {
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

      const createSourceFleetSetupPhase1Result = await createSourceFleetSetup({
        playerView,
        player,
        createdGameId,
        planets,
        origin,
        destination,
      })
      const { sourceFleet, improvedOnlyDestination } = createSourceFleetSetupPhase1Result
      Assert.isDefined(improvedOnlyDestination)

      const createSelectedViewSetupPhase2Result = await createSelectedViewSetup({
        ...createSourceFleetSetupPhase1Result,
        player,
        createdGameId,
        playerView,
        improvedOnlyDestination,
        destination,
        origin,
      })
      const { selectedView } = createSelectedViewSetupPhase2Result

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

      const createNormalizedSelectedViewSetupPhase3Result = await createNormalizedSelectedViewSetup({
        ...createSelectedViewSetupPhase2Result,
        origin,
        normalizeAction,
        clock,
        turnsRepository,
      })
      const { normalizedSelectedView, delegateStartTurnProcessing } = createNormalizedSelectedViewSetupPhase3Result
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

      assertSelectedView({ selectedView, moveAction, sourceFleet, destination, attackAction, evaluatePublicView, extraAttackAction })

      await assertBeforeRejectedDrafts({
        player,
        createdGameId,
        selectedView,
        attackAction,
        sourceFleet,
        destination,
        buildAction,
        origin,
        submitSelection,
        moveAction,
        evaluatePublicView,
        extraMoveAction,
      })

      await assertCanceledView({
        player,
        createdGameId,
        evaluatePublicView,
        moveAction,
        sourceFleet,
        submitSelection,
        clock,
        turnProcessor,
        turnsRepository,
        attackAction,
      })
    })
  })
})

async function createSourceFleetSetup({
  playerView,
  player,
  createdGameId,
  planets,
  origin,
  destination,
}: CreateSourceFleetSetupInput): Promise<CreateSourceFleetSetupResult> {
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

  await assertOutOfRangeSubmission({
    player,
    createdGameId,
    playerView,
    standardAction,
    sourceFleet,
    outsideStandardRange,
    destination,
  })

  await assertAfterFullForceCancel({
    player,
    createdGameId,
    playerView,
    standardAction,
    improvedAction,
    sourceFleet,
    destination,
    secondStandardAction,
  })

  // A candidate beyond Standard's five-light-year range but within Improved's ten-light-year range is legal.
  const improvedOnlyDestination = planets.find((planet) => {
    const distance = Math.hypot(planet.x - origin.x, planet.y - origin.y)
    return planet.ownerPlayerId === null && distance > 5 && distance <= 10
  })
  return { sourceFleet, standardAction, improvedAction, improvedOnlyDestination }
}

async function createSelectedViewSetup({
  player,
  createdGameId,
  playerView,
  improvedAction,
  sourceFleet,
  improvedOnlyDestination,
  destination,
  origin,
  standardAction,
}: CreateSelectedViewSetupInput): Promise<CreateSelectedViewSetupResult> {
  await assertImprovedRangeView({
    player,
    createdGameId,
    playerView,
    improvedAction,
    sourceFleet,
    improvedOnlyDestination,
    destination,
  })
  const retainedView = await player.client.gameplay.getPlayerView.query({ gameId: createdGameId })
  const retainedSource = retainedView.fleets.find(({ id }) => id === sourceFleet.id)
  Assert.isDefined(retainedSource)

  await assertNormalizedInput({
    retainedView,
    retainedSource,
    origin,
    destination,
    standardAction,
    player,
    createdGameId,
    playerView,
    sourceFleet,
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
  return { selectedView, selectedSource, selectedOrigin, selectedDestination }
}

async function createNormalizedSelectedViewSetup({
  selectedView,
  selectedSource,
  origin,
  selectedOrigin,
  selectedDestination,
  normalizeAction,
  clock,
  turnsRepository,
}: CreateNormalizedSelectedViewSetupInput): Promise<CreateNormalizedSelectedViewSetupResult> {
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
  return { normalizedSelectedView, delegateStartTurnProcessing }
}

type CreateSourceFleetSetupInput = {
  playerView: PlayerView
  player: AuthenticatedApiClient
  createdGameId: GameId
  planets: Planet[]
  origin: Planet
  destination: Planet
}

type CreateSourceFleetSetupResult = {
  sourceFleet: Fleet
  standardAction: Action
  improvedAction: Action
  improvedOnlyDestination: undefined | Planet
}

type CreateSelectedViewSetupInput = {
  player: AuthenticatedApiClient
  createdGameId: GameId
  playerView: PlayerView
  improvedAction: Action
  sourceFleet: Fleet
  improvedOnlyDestination: Planet
  destination: Planet
  origin: Planet
  standardAction: Action
}

type CreateSelectedViewSetupResult = {
  selectedView: PlayerView
  selectedSource: Fleet
  selectedOrigin: Planet
  selectedDestination: Planet
}

type CreateNormalizedSelectedViewSetupInput = {
  selectedView: PlayerView
  selectedSource: Fleet
  origin: Planet
  selectedOrigin: Planet
  selectedDestination: Planet
  normalizeAction: (action: {
    id: string
    actionDefinitionId: string
    selectedTargets: unknown
    selectedInputs: unknown
    isInProgress: false | true
  }) => {
    id: string
    actionDefinitionId: string
    selectedTargets: null | { fleet: undefined | string; planet: undefined | string }
    selectedInputs: unknown
    isInProgress: false | true
  }
  clock: ControlledClock
  turnsRepository: TurnsRepository
}

type CreateNormalizedSelectedViewSetupResult = {
  normalizedSelectedView: {
    resources: { total: Record<string, number>; uncommitted: Record<string, number> }
    source: {
      role: string
      owner: string
      strength: number
      origin: string
      movement: null | {
        speed: PositiveNumber
        departureTurn: PositiveInteger
        submission: {
          id: ActionId
          playerId: PlayerId
          actionDefinitionId: ActionDefinitionId
          selectedTargets: Readonly<Record<TargetTag, PlayerId | PlanetId | FleetId>>
          selectedInputs: Readonly<Record<InputTag, PositiveInteger>>
        }
        pendingArrivalEffects: ReadonlyArray<
          | {
              effectDefinition: {
                type: "FLEET_ASSAULT"
                targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
                parameters: Record<string, never>
              }
              definitionOrdinal: NonNegativeSafeInteger
            }
          | {
              effectDefinition: {
                type: "FLEET_COLONIZE"
                targets: { fleet: EffectDefinitionTargetDefinition<"FLEET">; planet: EffectDefinitionTargetDefinition<"PLANET"> }
                parameters: { strengthRequirement: PositiveInteger }
              }
              definitionOrdinal: NonNegativeSafeInteger
            }
        >
      }
    }
    planets: Array<{ role: string; owner: null | string | PlayerId; x: number; y: number }>
    authorizedActions: Array<{ id: ActionId; actionDefinitionId: ActionDefinitionId }>
    currentActions: Array<{
      id: string
      actionDefinitionId: string
      selectedTargets: null | { fleet: undefined | string; planet: undefined | string }
      selectedInputs: unknown
      isInProgress: false | true
    }>
  }
  delegateStartTurnProcessing: TurnsRepository["startTurnProcessing"]
}
