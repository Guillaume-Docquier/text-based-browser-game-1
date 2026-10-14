import { branded, indexBy } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { computeAvailableActions } from "#shared/action-submission/computeAvailableActions.ts"
import type { ActionSelectionDraft, EligibilityState } from "#shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "#shared/domain/games/GameId.ts"
import { PlayerIdSchema, type PlayerId } from "#shared/domain/players/PlayerId.ts"
import { createResourcesStub } from "#shared/domain/resources/Resources.stub.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { createRulesetStub } from "#shared/domain/ruleset/Ruleset.stub.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ActionId } from "#shared/domain/turns/actions/ActionId.ts"
import { createFleetStub } from "#shared/domain/world/fleets/Fleet.stub.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { createPlanetStub } from "#shared/domain/world/planets/Planet.stub.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { FleetActionSelectionParity } from "#shared/testing/FleetActionSelectionParity.ts"
import { ColonizeHereTest } from "#shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "#shared/testing/test-ruleset/action-definitions/move-fleet.ts"

export function replaceActionById(
  actions: EligibilityState["actions"],
  replacement: EligibilityState["actions"][number],
): EligibilityState["actions"] {
  const replacementById = new Map([[replacement.id, replacement]])
  return actions.map((action) => replacementById.get(action.id) ?? action)
}

export function normalizeFleetSelectionInput(
  state: EligibilityState,
  ruleset: Ruleset,
  fixture: ReturnType<typeof createFixture>,
  parity: typeof FleetActionSelectionParity,
  candidateActionId: ActionId,
): unknown {
  const sourceFleet = state.fleets[fixture.fleetId]
  const originPlanet = state.planets[fixture.originId]
  const destinationPlanet = state.planets[fixture.destinationId]
  const uncommittedResources = Object.fromEntries(
    Object.values(ResourceType).map((resourceType) => [
      resourceType,
      state.resources[resourceType] -
        state.actions
          .filter((action) => action.selectedTargets !== null)
          .flatMap((action) => ruleset.actionDefinitions[action.actionDefinitionId]?.costs ?? [])
          .filter((cost) => cost.type === "RESOURCE_LOSS" && cost.parameters.resourceType === resourceType)
          .reduce((total, cost) => total + cost.parameters.quantity, 0),
    ]),
  )

  return {
    resources: {
      total: Object.fromEntries(Object.values(ResourceType).map((resourceType) => [resourceType, state.resources[resourceType]])),
      uncommitted: uncommittedResources,
    },
    source: {
      role: "source",
      owner: sourceFleet?.ownerPlayerId === fixture.playerId ? "player" : "other",
      strength: sourceFleet?.strength,
      origin: sourceFleet?.originPlanetId === fixture.originId ? "origin" : "other",
      movement: sourceFleet?.movement ?? null,
    },
    planets: [
      {
        role: "origin",
        owner: originPlanet?.ownerPlayerId === fixture.playerId ? "player" : "other",
        x: originPlanet?.x,
        y: originPlanet?.y,
      },
      {
        role: "destination",
        owner: destinationPlanet?.ownerPlayerId === null ? null : "other",
        x: destinationPlanet?.x,
        y: destinationPlanet?.y,
      },
    ],
    authorizedActions: ruleset.actionPool
      .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
      .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
    currentActions: state.actions
      .map(({ id, actionDefinitionId, selectedTargets, selectedInputs }) => {
        const fleetTargetId = selectedTargets?.[branded<TargetTag>("fleet")]
        const planetTargetId = selectedTargets?.[branded<TargetTag>("planet")]
        return {
          id,
          actionDefinitionId,
          selectedTargets:
            selectedTargets === null
              ? null
              : {
                  fleet: fleetTargetId === fixture.fleetId ? "source" : fleetTargetId,
                  planet: planetTargetId === fixture.destinationId ? "destination" : planetTargetId,
                },
          selectedInputs,
          isInProgress: Object.values(state.fleets).some((fleet) => fleet.movement?.submission.id === id),
        }
      })
      .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
    candidate: {
      id: candidateActionId,
      actionDefinitionId: MoveFleetStandard.id,
      selectedTargets: { fleet: "source", planet: "destination" },
      selectedInputs: { strength: parity.standardStrength },
    },
  }
}

export function createFixture(): {
  playerId: PlayerId
  firstActionId: ActionId
  secondActionId: ActionId
  fleetId: FleetId
  originId: PlanetId
  destinationId: PlanetId
  ruleset: ReturnType<typeof createRulesetStub>
  state: EligibilityState
} {
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000011")
  const firstActionId = branded<ActionId>("MOVE_FLEET_1")
  const secondActionId = branded<ActionId>("MOVE_FLEET_2")
  const fleetId = branded<FleetId>("fleet-source")
  const originId = branded<PlanetId>("planet-origin")
  const destinationId = branded<PlanetId>("planet-destination")
  const ruleset = createRulesetStub({
    actionDefinitions: indexBy("id", [MoveFleetStandard]),
    actionPool: [
      { id: firstActionId, actionDefinitionId: MoveFleetStandard.id },
      { id: secondActionId, actionDefinitionId: MoveFleetStandard.id },
    ],
  })
  const origin = createPlanetStub({ id: originId, ownerPlayerId: playerId, name: "Origin", x: 0, y: 0 })
  const destination = createPlanetStub({ id: destinationId, ownerPlayerId: null, name: "Destination", x: 4, y: 0 })
  const fleet = createFleetStub({ id: fleetId, ownerPlayerId: playerId, originPlanetId: originId, strength: 50, name: "Source Fleet" })
  const actions = computeAvailableActions({ playerIds: [playerId], ruleset })

  return {
    playerId,
    firstActionId,
    secondActionId,
    fleetId,
    originId,
    destinationId,
    ruleset,
    state: {
      gameId: typedParse(GameIdSchema, 1),
      turn: 1,
      submittingPlayerId: playerId,
      resources: createResourcesStub({ [ResourceType.INFLUENCE]: 6, [ResourceType.FUEL]: 2 }),
      players: { [playerId]: { id: playerId, ownerPlayerId: playerId } },
      planets: indexBy("id", [origin, destination]),
      fleets: indexBy("id", [fleet]),
      actions,
    },
  }
}

export function createSubmission(
  fixture: ReturnType<typeof createFixture>,
  id: ActionId,
  strength: number,
): ReturnType<typeof createSubmittedActionStub> {
  return createSubmittedActionStub({
    id,
    playerId: fixture.playerId,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
    selectedInputs: { [branded<InputTag>("strength")]: strength },
  })
}

export function createDraft(fixture: ReturnType<typeof createFixture>, actionId: ActionId, strength: number): ActionSelectionDraft {
  return {
    actionId,
    selectedTargets: { [branded<TargetTag>("fleet")]: fixture.fleetId, [branded<TargetTag>("planet")]: fixture.destinationId },
    selectedInputs: { [branded<InputTag>("strength")]: strength },
  }
}

export function createColonizationBudgetFixture(strength: number): {
  playerId: PlayerId
  moveActionId: ActionId
  colonizeActionId: ActionId
  secondColonizeActionId: ActionId
  fleetId: FleetId
  secondFleetId: FleetId
  originId: PlanetId
  destinationId: PlanetId
  ruleset: ReturnType<typeof createRulesetStub>
  state: EligibilityState
} {
  const playerId = typedParse(PlayerIdSchema, "00000000-0000-4000-8000-000000000031")
  const moveActionId = branded<ActionId>("MOVE_FLEET_TEST")
  const colonizeActionId = branded<ActionId>("COLONIZE_HERE_TEST")
  const secondColonizeActionId = branded<ActionId>("COLONIZE_HERE_TEST_2")
  const fleetId = branded<FleetId>("fleet-colonization-budget")
  const secondFleetId = branded<FleetId>("fleet-colonization-second")
  const originId = branded<PlanetId>("planet-colonization-origin")
  const destinationId = branded<PlanetId>("planet-colonization-destination")
  const ruleset = createRulesetStub({
    actionDefinitions: indexBy("id", [MoveFleetStandard, ColonizeHereTest]),
    actionPool: [
      { id: moveActionId, actionDefinitionId: MoveFleetStandard.id },
      { id: colonizeActionId, actionDefinitionId: ColonizeHereTest.id },
      { id: secondColonizeActionId, actionDefinitionId: ColonizeHereTest.id },
    ],
  })
  const origin = createPlanetStub({ id: originId, ownerPlayerId: null, x: 0, y: 0 })
  const destination = createPlanetStub({ id: destinationId, ownerPlayerId: null, x: 4, y: 0 })
  const fleet = createFleetStub({ id: fleetId, ownerPlayerId: playerId, originPlanetId: originId, strength })
  const secondFleet = createFleetStub({ id: secondFleetId, ownerPlayerId: playerId, originPlanetId: destinationId, strength: 30 })
  const state: EligibilityState = {
    gameId: typedParse(GameIdSchema, 1),
    turn: 1,
    submittingPlayerId: playerId,
    resources: createResourcesStub({ [ResourceType.INFLUENCE]: 100, [ResourceType.FUEL]: 10 }),
    players: indexBy("id", [{ id: playerId, ownerPlayerId: playerId }]),
    planets: indexBy("id", [origin, destination]),
    fleets: indexBy("id", [fleet, secondFleet]),
    actions: computeAvailableActions({ playerIds: [playerId], ruleset }),
  }
  return {
    playerId,
    moveActionId,
    colonizeActionId,
    secondColonizeActionId,
    fleetId,
    secondFleetId,
    originId,
    destinationId,
    ruleset,
    state,
  }
}

export function withSubmissions(state: EligibilityState, submissions: Array<ReturnType<typeof createSubmission>>): EligibilityState {
  const submissionsById = new Map(submissions.map((submission) => [submission.id, submission]))
  return {
    ...state,
    actions: state.actions.map((action) => submissionsById.get(action.id) ?? action),
  }
}
