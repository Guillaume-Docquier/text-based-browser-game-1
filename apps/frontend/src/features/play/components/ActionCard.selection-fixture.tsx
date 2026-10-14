import type { Action, ActionId, SelectedTargets, SelectedInputs, PlayerView, Players } from "@api-types"
import { Assert, branded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ReactElement, useState } from "react"
import { evaluateTargetCandidate } from "shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { FleetActionSelectionParity, FleetActionSelectionParityActionPool } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { ActionCard } from "./ActionCard.tsx"
import { createEligibilityState } from "./ActionSelector.tsx"

export const player = createPlayerStub()

export const playerViewPlayer = { id: player.id, color: player.color, isReady: false }

export const home = createPlanetStub({ id: "planet-home", ownerPlayerId: player.id, name: "Home", coordinates: "0:0:0", x: 0, y: 0 })

export const northernStation = createPlanetStub({
  id: "planet-north",
  ownerPlayerId: player.id,
  name: "Northern Station",
  coordinates: "10:0:0",
  x: 10,
  y: 0,
})

export const waypoint = createPlanetStub({ id: "planet-waypoint", name: "Waypoint", coordinates: "2:0:0", x: 2, y: 0 })

export const waypointTwo = createPlanetStub({ id: "planet-waypoint-two", name: "Inner Reach", coordinates: "4:0:0", x: 4, y: 0 })

export const farReach = createPlanetStub({ id: "planet-far-reach", name: "Far Reach", coordinates: "14:0:0", x: 14, y: 0 })

export const northernReach = createPlanetStub({
  id: "planet-northern-reach",
  name: "Northern Reach",
  coordinates: "15:0:0",
  x: 15,
  y: 0,
})

export const planets = [home, northernStation, waypoint, waypointTwo, farReach]

export const homeFleet = createFleetStub({
  id: "fleet-home-guard",
  ownerPlayerId: player.id,
  name: "Home Guard",
  strength: 50,
  originPlanetId: home.id,
})

export const northernFleet = createFleetStub({
  id: "fleet-northern-guard",
  ownerPlayerId: player.id,
  name: "Northern Guard",
  strength: 30,
  originPlanetId: northernStation.id,
})

export const currentAction = createAvailableActionStub({
  id: "MOVE_FLEET_STANDARD_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})

export const existingAllocation = createSubmittedActionStub({
  id: "MOVE_FLEET_STANDARD_2",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
  selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
  selectedInputs: { strength: 15 },
})

export const gameId = typedParse(GameIdSchema, 77)

export const storyRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [...TestRuleset.actionPool, { id: existingAllocation.id, actionDefinitionId: MoveFleetStandard.id }],
})

export const apiActions = [toActionDto(currentAction, false), toActionDto(existingAllocation, false)]

export const playerView = {
  gameId,
  player: playerViewPlayer,
  opponents: {},
  galaxy: { systems: [{ star: createStarStub({ id: "star-home", name: "Sol", coordinates: "0:0", x: 0, y: 0 }), planets }] },
  fleets: [homeFleet, northernFleet],
  turn: 4,
  turnStatus: "COLLECTING_ACTIONS",
  turnEndsAt: "2030-01-01T00:00:00.000Z",
  resources: {
    [ResourceType.INFLUENCE]: { total: 20, uncommitted: 17 },
    [ResourceType.METAL]: { total: 0, uncommitted: 0 },
    [ResourceType.FUEL]: { total: 10, uncommitted: 9 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
  },
  ruleset: storyRuleset,
  actions: apiActions,
} satisfies PlayerView

export const frontendProjection = requireEligibilityProjection(playerView)

export const actionForCard = requiredStoryValue(apiActions[0])

export const players: Players = [player]

export const parityOrigin = createPlanetStub({
  id: "parity-origin",
  ownerPlayerId: player.id,
  name: "Parity Home",
  coordinates: "45:98:30",
  x: FleetActionSelectionParity.origin.x,
  y: FleetActionSelectionParity.origin.y,
})

export const parityDestination = createPlanetStub({
  id: "parity-destination",
  ownerPlayerId: null,
  name: "Parity Reach",
  coordinates: "55:07:50",
  x: FleetActionSelectionParity.destination.x,
  y: FleetActionSelectionParity.destination.y,
})

export const parityNearbyPlanet = createPlanetStub({
  id: "parity-nearby-planet",
  ownerPlayerId: null,
  name: "Parity Nearby",
  coordinates: "45:98:35",
  x: FleetActionSelectionParity.origin.x + 2,
  y: FleetActionSelectionParity.origin.y,
})

export const parityImprovedOnlyPlanet = createPlanetStub({
  id: "parity-improved-only-planet",
  ownerPlayerId: null,
  name: "Parity Improved Reach",
  coordinates: "52:98:30",
  x: FleetActionSelectionParity.origin.x + 7,
  y: FleetActionSelectionParity.origin.y,
})

export const parityFarPlanet = createPlanetStub({
  id: "parity-far-planet",
  ownerPlayerId: null,
  name: "Parity Far Reach",
  coordinates: "90:90:90",
  x: FleetActionSelectionParity.origin.x + 25,
  y: FleetActionSelectionParity.origin.y,
})

export const parityFleet = createFleetStub({
  id: "parity-source-fleet",
  ownerPlayerId: player.id,
  name: "Parity Source",
  strength: FleetActionSelectionParity.sourceStrength,
  originPlanetId: parityOrigin.id,
})

export const parityStandardAction = createAvailableActionStub({
  id: "MOVE_FLEET_STANDARD_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})

export const parityImprovedAction = createSubmittedActionStub({
  id: "MOVE_FLEET_IMPROVED_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetImproved.id,
  selectedTargets: { fleet: parityFleet.id, planet: parityDestination.id },
  selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
})

export const parityRuleset = Ruleset.create({ ...TestRuleset, actionPool: FleetActionSelectionParityActionPool })

export const parityCurrentActions = FleetActionSelectionParityActionPool.map(({ id, actionDefinitionId }) =>
  id === parityImprovedAction.id
    ? toActionDto(parityImprovedAction, false)
    : toActionDto(createAvailableActionStub({ id, playerId: player.id, actionDefinitionId }), false),
)

export const parityPlayerView = {
  ...playerView,
  galaxy: {
    systems: [
      {
        star: createStarStub({ id: "parity-star", name: "Parity System", coordinates: "45:98", x: parityOrigin.x, y: parityOrigin.y }),
        planets: [parityOrigin, parityDestination, parityNearbyPlanet, parityImprovedOnlyPlanet, parityFarPlanet],
      },
    ],
  },
  fleets: [parityFleet],
  resources: {
    ...playerView.resources,
    [ResourceType.INFLUENCE]: { total: FleetActionSelectionParity.totalResources.INFLUENCE, uncommitted: 3 },
    [ResourceType.FUEL]: { total: FleetActionSelectionParity.totalResources.FUEL, uncommitted: 1 },
  },
  ruleset: parityRuleset,
  actions: parityCurrentActions,
} satisfies PlayerView

export const parityNormalizedInput = {
  resources: {
    total: Object.fromEntries(
      Object.values(ResourceType).map((resourceType) => [resourceType, parityPlayerView.resources[resourceType].total]),
    ),
    uncommitted: Object.fromEntries(
      Object.values(ResourceType).map((resourceType) => [resourceType, parityPlayerView.resources[resourceType].uncommitted]),
    ),
  },
  source: {
    role: "source",
    owner: parityFleet.ownerPlayerId === player.id ? "player" : "other",
    strength: parityFleet.strength,
    origin: parityFleet.originPlanetId === parityOrigin.id ? "origin" : "other",
    movement: parityFleet.movement ?? null,
  },
  planets: [
    {
      role: "origin",
      owner: parityOrigin.ownerPlayerId === player.id ? "player" : parityOrigin.ownerPlayerId,
      x: parityOrigin.x,
      y: parityOrigin.y,
    },
    {
      role: "destination",
      owner: parityDestination.ownerPlayerId === null ? null : "other",
      x: parityDestination.x,
      y: parityDestination.y,
    },
  ],
  authorizedActions: parityPlayerView.ruleset.actionPool
    .map(({ id, actionDefinitionId }) => ({ id, actionDefinitionId }))
    .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
  currentActions: parityPlayerView.actions
    .map(({ id, actionDefinitionId, selectedTargets, selectedInputs, isInProgress }) => ({
      id,
      actionDefinitionId,
      selectedTargets:
        selectedTargets === null
          ? null
          : {
              fleet:
                selectedTargets[branded<TargetTag>("fleet")] === parityFleet.id ? "source" : selectedTargets[branded<TargetTag>("fleet")],
              planet:
                selectedTargets[branded<TargetTag>("planet")] === parityDestination.id
                  ? "destination"
                  : selectedTargets[branded<TargetTag>("planet")],
            },
      selectedInputs,
      isInProgress,
    }))
    .toSorted((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0)),
  candidate: {
    id: parityStandardAction.id,
    actionDefinitionId: MoveFleetStandard.id,
    selectedTargets: { fleet: "source", planet: "destination" },
    selectedInputs: { strength: FleetActionSelectionParity.standardStrength },
  },
}

export const parityProjection = requireEligibilityProjection(parityPlayerView)

export const composedMoveAction = createAvailableActionStub({
  id: MoveFleetStandard.id + "_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})

export const composedAttackAction = createAvailableActionStub({
  id: AttackMoveTest.id + "_1",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})

export const composedPartialAttackAction = createAvailableActionStub({
  id: AttackMoveTest.id + "_2",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})

export const composedReservationRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [...TestRuleset.actionPool, { id: composedPartialAttackAction.id, actionDefinitionId: AttackMoveTest.id }],
})

export const composedReservationPlayerView = {
  ...parityPlayerView,
  resources: {
    ...parityPlayerView.resources,
    [ResourceType.INFLUENCE]: { total: 8, uncommitted: 8 },
    [ResourceType.FUEL]: { total: 2, uncommitted: 2 },
  },
  ruleset: composedReservationRuleset,
  actions: [
    toActionDto(composedMoveAction, false),
    toActionDto(composedAttackAction, false),
    toActionDto(composedPartialAttackAction, false),
  ],
} satisfies PlayerView

export function ComposedReservationCards(): ReactElement {
  const [actions, setActions] = useState(composedReservationPlayerView.actions)
  const playerView = { ...composedReservationPlayerView, actions }
  const projection = requireEligibilityProjection(playerView)

  function updateSelection(actionId: ActionId, selectedTargets: SelectedTargets, selectedInputs: SelectedInputs): void {
    setActions((currentActions) =>
      currentActions.map((action) => {
        return replaceStorySelection(action, actionId, selectedTargets, selectedInputs)
      }),
    )
  }

  const moveAction = actions.find(({ id }) => id === composedMoveAction.id)
  const attackAction = actions.find(({ id }) => id === composedAttackAction.id)
  if (moveAction === undefined || attackAction === undefined) {
    throw new Error("Expected the ordinary Move and Attack Move instances")
  }
  const partialCandidate = evaluateTargetCandidate({
    state: projection.eligibilityState,
    ruleset: projection.ruleset,
    draft: { actionId: composedPartialAttackAction.id, selectedTargets: {}, selectedInputs: {} },
    targetTag: branded<TargetTag>("fleet"),
    targetId: parityFleet.id,
  })
  const partialCandidateOracle = JSON.stringify({
    status: partialCandidate.status,
    candidateStatus: partialCandidate.candidateStatus,
    candidateIssues: partialCandidate.candidateIssues.map(({ code }) => code),
    missingTargets: partialCandidate.missingTargets,
    missingInputs: partialCandidate.missingInputs,
    strengthCommitment: partialCandidate.strengthCommitments[parityFleet.id],
    remainingStrength: partialCandidate.remainingStrength[parityFleet.id],
    resourceCommitments: partialCandidate.resourceCommitments,
  })

  return (
    <div className="flex flex-wrap gap-4">
      <output className="sr-only" data-testid="composed-partial-attack-candidate">
        {partialCandidateOracle}
      </output>
      <ActionCard
        actionDefinition={MoveFleetStandard}
        action={moveAction}
        playerView={playerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          updateSelection(moveAction.id, selectedTargets, selectedInputs)
        }}
      />
      <ActionCard
        actionDefinition={AttackMoveTest}
        action={attackAction}
        playerView={playerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          updateSelection(attackAction.id, selectedTargets, selectedInputs)
        }}
      />
    </div>
  )
}
function replaceStorySelection(
  action: Action,
  actionId: ActionId,
  selectedTargets: SelectedTargets,
  selectedInputs: SelectedInputs,
): Action {
  if (action.id !== actionId) {
    return action
  }
  if (selectedTargets === null && selectedInputs === null) {
    return { ...action, selectedTargets: null, selectedInputs: null }
  }
  if (selectedTargets === null || selectedInputs === null) {
    throw new Error("A composed action selection must include both targets and inputs")
  }
  return { ...action, selectedTargets, selectedInputs }
}

export const attackMoveAction = createAvailableActionStub({
  id: "TEST_ATTACK_MOVE_1",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})

export const attackMovePlayerView = {
  ...playerView,
  galaxy: {
    systems: playerView.galaxy.systems.map(({ star, planets: systemPlanets }) => ({
      star,
      planets: [...systemPlanets, northernReach],
    })),
  },
  ruleset: TestRuleset,
  actions: [toActionDto(attackMoveAction, false)],
} satisfies PlayerView

export const attackMoveProjection = requireEligibilityProjection(attackMovePlayerView)

export function toActionDto(action: Omit<Action, "canAfford" | "isInProgress">, isInProgress: boolean): Action {
  return { ...action, canAfford: true, isInProgress }
}
/**
 * Parses the same frontend projection used by the public Action selector.
 */
export function requireEligibilityProjection(view: PlayerView): Extract<ReturnType<typeof createEligibilityState>, { success: true }> {
  const projection = createEligibilityState(view)
  if (!projection.success) {
    throw new Error(projection.message)
  }
  return projection
}
function requiredStoryValue<T>(value: T | undefined): T {
  Assert.isDefined(value)
  return value
}

/**
 * Keeps an unsubmitted draft mounted while another Action consumes its selected Fleet.
 */
export function DraftReservationRecoveryCards(): ReactElement {
  const [actions, setActions] = useState<Action[]>(apiActions)
  const currentView = { ...playerView, actions }
  const projection = requireEligibilityProjection(currentView)
  return (
    <div className="flex flex-wrap gap-4">
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          actionDefinition={MoveFleetStandard}
          action={action}
          playerView={currentView}
          players={players}
          ruleset={projection.ruleset}
          eligibilityState={projection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            setActions((current) => current.map((entry) => replaceStorySelection(entry, action.id, selectedTargets, selectedInputs)))
          }}
        />
      ))}
    </div>
  )
}
