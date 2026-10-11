import type { Action, PlayerView, Players } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { evaluateSubmittedActions, evaluateTargetCandidate } from "shared/action-submission/evaluateActionSelection.ts"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import type { TargetTag } from "shared/domain/ruleset/action-definitions/TargetTag.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetExceptional, MoveFleetImproved, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect, within } from "storybook/test"
import { createPlayerStub } from "@/lib/api/Player.stub.ts"
import { ActionCard } from "./ActionCard.tsx"
import { createEligibilityState } from "./ActionSelector.tsx"

const player = createPlayerStub()
const playerViewPlayer = { id: player.id, color: player.color, isReady: false }
const home = createPlanetStub({ id: "planet-home", ownerPlayerId: player.id, name: "Home", coordinates: "0:0:0", x: 0, y: 0 })
const northernStation = createPlanetStub({
  id: "planet-north",
  ownerPlayerId: player.id,
  name: "Northern Station",
  coordinates: "10:0:0",
  x: 10,
  y: 0,
})
const waypoint = createPlanetStub({ id: "planet-waypoint", name: "Waypoint", coordinates: "2:0:0", x: 2, y: 0 })
const waypointTwo = createPlanetStub({ id: "planet-waypoint-two", name: "Inner Reach", coordinates: "4:0:0", x: 4, y: 0 })
const farReach = createPlanetStub({ id: "planet-far-reach", name: "Far Reach", coordinates: "14:0:0", x: 14, y: 0 })
const northernReach = createPlanetStub({
  id: "planet-northern-reach",
  name: "Northern Reach",
  coordinates: "15:0:0",
  x: 15,
  y: 0,
})
const planets = [home, northernStation, waypoint, waypointTwo, farReach]
const homeFleet = createFleetStub({
  id: "fleet-home-guard",
  ownerPlayerId: player.id,
  name: "Home Guard",
  strength: 50,
  originPlanetId: home.id,
})
const northernFleet = createFleetStub({
  id: "fleet-northern-guard",
  ownerPlayerId: player.id,
  name: "Northern Guard",
  strength: 30,
  originPlanetId: northernStation.id,
})
const currentAction = createAvailableActionStub({
  id: "MOVE_FLEET_STANDARD_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})
const existingAllocation = createSubmittedActionStub({
  id: "MOVE_FLEET_STANDARD_2",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
  selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
  selectedInputs: { strength: 15 },
})
const gameId = GameIdSchema.parse(77)
const storyRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [...TestRuleset.actionPool, { id: existingAllocation.id, actionDefinitionId: MoveFleetStandard.id }],
})
const apiActions = [toActionDto(currentAction, false), toActionDto(existingAllocation, false)]
const playerView = {
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
const frontendProjection = createEligibilityState(playerView)
if (!frontendProjection.success) {
  throw new Error(frontendProjection.message)
}
const actionForCard = apiActions[0]
if (actionForCard === undefined) {
  throw new Error("Expected the first movement Action instance")
}
const players: Players = [player]
const parityOrigin = createPlanetStub({
  id: "parity-origin",
  ownerPlayerId: player.id,
  name: "Parity Home",
  coordinates: "45:98:30",
  x: FleetActionSelectionParity.origin.x,
  y: FleetActionSelectionParity.origin.y,
})
const parityDestination = createPlanetStub({
  id: "parity-destination",
  ownerPlayerId: null,
  name: "Parity Reach",
  coordinates: "55:07:50",
  x: FleetActionSelectionParity.destination.x,
  y: FleetActionSelectionParity.destination.y,
})
const parityNearbyPlanet = createPlanetStub({
  id: "parity-nearby-planet",
  ownerPlayerId: null,
  name: "Parity Nearby",
  coordinates: "45:98:35",
  x: FleetActionSelectionParity.origin.x + 2,
  y: FleetActionSelectionParity.origin.y,
})
const parityImprovedOnlyPlanet = createPlanetStub({
  id: "parity-improved-only-planet",
  ownerPlayerId: null,
  name: "Parity Improved Reach",
  coordinates: "52:98:30",
  x: FleetActionSelectionParity.origin.x + 7,
  y: FleetActionSelectionParity.origin.y,
})
const parityFarPlanet = createPlanetStub({
  id: "parity-far-planet",
  ownerPlayerId: null,
  name: "Parity Far Reach",
  coordinates: "90:90:90",
  x: FleetActionSelectionParity.origin.x + 25,
  y: FleetActionSelectionParity.origin.y,
})
const parityFleet = createFleetStub({
  id: "parity-source-fleet",
  ownerPlayerId: player.id,
  name: "Parity Source",
  strength: FleetActionSelectionParity.sourceStrength,
  originPlanetId: parityOrigin.id,
})
const parityStandardAction = createAvailableActionStub({
  id: "MOVE_FLEET_STANDARD_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})
const parityImprovedAction = createSubmittedActionStub({
  id: "MOVE_FLEET_IMPROVED_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetImproved.id,
  selectedTargets: { fleet: parityFleet.id, planet: parityDestination.id },
  selectedInputs: { strength: FleetActionSelectionParity.improvedStrength },
})
const parityPlayerView = {
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
  ruleset: TestRuleset,
  actions: [toActionDto(parityStandardAction, false), toActionDto(parityImprovedAction, false)],
} satisfies PlayerView
const parityProjection = createEligibilityState(parityPlayerView)
if (!parityProjection.success) {
  throw new Error(parityProjection.message)
}

const composedMoveAction = createAvailableActionStub({
  id: MoveFleetStandard.id + "_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})
const composedAttackAction = createAvailableActionStub({
  id: AttackMoveTest.id + "_1",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})
const composedPartialAttackAction = createAvailableActionStub({
  id: AttackMoveTest.id + "_2",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})
const composedReservationRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [...TestRuleset.actionPool, { id: composedPartialAttackAction.id, actionDefinitionId: AttackMoveTest.id }],
})
const composedReservationPlayerView = {
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

function ComposedReservationCards(): ReactElement {
  const [actions, setActions] = useState(composedReservationPlayerView.actions)
  const playerView = { ...composedReservationPlayerView, actions }
  const projection = createEligibilityState(playerView)
  if (!projection.success) {
    throw new Error(projection.message)
  }

  function updateSelection(
    actionId: Action["id"],
    selectedTargets: Action["selectedTargets"],
    selectedInputs: Action["selectedInputs"],
  ): void {
    setActions((currentActions) =>
      currentActions.map((action) => {
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

const attackMoveAction = createAvailableActionStub({
  id: "TEST_ATTACK_MOVE_1",
  playerId: player.id,
  actionDefinitionId: AttackMoveTest.id,
})
const attackMovePlayerView = {
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
const attackMoveProjection = createEligibilityState(attackMovePlayerView)
if (!attackMoveProjection.success) {
  throw new Error(attackMoveProjection.message)
}

type ConjoinedRangeProjection = Extract<ReturnType<typeof createEligibilityState>, { success: true }>
type ConjoinedRangeFixture = Readonly<{
  actionDefinition: ActionDefinition
  action: Action
  playerView: PlayerView
  projection: ConjoinedRangeProjection
}>

const assaultRangeBoundary = createPlanetStub({
  id: "planet-assault-range-boundary",
  name: "Range Edge",
  coordinates: "5:0:0",
  x: 5,
  y: 0,
})

function createConjoinedRangeFixture({
  id,
  name,
  rangeLimits,
}: {
  id: string
  name: string
  rangeLimits: readonly [number, number]
}): ConjoinedRangeFixture {
  const actionDefinition = ActionDefinitionSchema.parse({
    ...AttackMoveTest,
    id,
    name,
    targets: {
      ...AttackMoveTest.targets,
      [branded<TargetTag>("planet")]: {
        ...AttackMoveTest.targets[branded<TargetTag>("planet")],
        constraints: [
          ...rangeLimits.map((maxDistance) => WithinFleetRangeConstraint.create({ sourceFleetTag: "fleet", maxDistance })),
          DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "fleet" }),
        ],
      },
    },
  })
  const action = createAvailableActionStub({
    id: `${id}_1`,
    playerId: player.id,
    actionDefinitionId: actionDefinition.id,
  })
  const ruleset = Ruleset.create({
    ...TestRuleset,
    id: `${id.toLowerCase()}_ruleset`,
    name,
    actionDefinitions: { ...TestRuleset.actionDefinitions, [actionDefinition.id]: actionDefinition },
    actionPool: [...TestRuleset.actionPool, { id: action.id, actionDefinitionId: actionDefinition.id }],
  })
  const view = {
    ...attackMovePlayerView,
    galaxy: {
      systems: [
        {
          star: createStarStub({ id: `${id}-star`, name: "Range System", coordinates: "0:0", x: 0, y: 0 }),
          planets: [home, assaultRangeBoundary],
        },
      ],
    },
    fleets: [homeFleet],
    ruleset,
    actions: [toActionDto(action, false)],
  } satisfies PlayerView
  const projection = createEligibilityState(view)
  if (!projection.success) {
    throw new Error(projection.message)
  }

  return { actionDefinition, action: toActionDto(action, false), playerView: view, projection }
}

const forwardConjoinedRangeFixture = createConjoinedRangeFixture({
  id: "TEST_CONJOINED_RANGE_FORWARD",
  name: "Conjoined Range Forward",
  rangeLimits: [10, 5],
})
const reversedConjoinedRangeFixture = createConjoinedRangeFixture({
  id: "TEST_CONJOINED_RANGE_REVERSED",
  name: "Conjoined Range Reversed",
  rangeLimits: [5, 10],
})

function ConjoinedRangeCard({ fixture }: { fixture: ConjoinedRangeFixture }): ReactElement {
  const [action, setAction] = useState(fixture.action)
  return (
    <div className="w-80">
      <ActionCard
        actionDefinition={fixture.actionDefinition}
        action={action}
        playerView={fixture.playerView}
        players={players}
        ruleset={fixture.projection.ruleset}
        eligibilityState={fixture.projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setAction({ ...action, selectedTargets, selectedInputs })
        }}
      />
    </div>
  )
}
const renamedRelayDefinition = ActionDefinitionSchema.parse({
  ...AttackMoveTest,
  id: "TEST_RENAMED_SIEGE_RELAY",
  name: "Siege Relay",
  tier: ActionTier.EXCEPTIONAL,
  inputs: { units: { type: "POSITIVE_INTEGER", label: "Units" } },
  targets: {
    originForce: AttackMoveTest.targets[branded<TargetTag>("fleet")],
    landingSite: {
      ...AttackMoveTest.targets[branded<TargetTag>("planet")],
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "originForce", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "originForce" }),
      ],
    },
  },
  costs: AttackMoveTest.costs.map((cost) => ({
    ...cost,
    parameters: {
      ...cost.parameters,
      quantity: cost.parameters.resourceType === ResourceType.INFLUENCE ? 7 : 2,
    },
  })),
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite", strengthTag: "units", speed: 2 }),
    FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" }),
  ],
})
const renamedRelayCapturedSubmission = createSubmittedActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_1",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
  selectedTargets: { originForce: homeFleet.id, landingSite: waypoint.id },
  selectedInputs: { units: 20 },
})
const renamedRelayBusyAction = {
  ...createAvailableActionStub({
    id: renamedRelayCapturedSubmission.id,
    playerId: player.id,
    actionDefinitionId: renamedRelayDefinition.id,
  }),
  selectedTargets: null,
  selectedInputs: null,
}
const renamedRelayDraftAction = createAvailableActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_2",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
})
const renamedRelayUnaffordableAction = createSubmittedActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_3",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
  selectedTargets: { originForce: homeFleet.id, landingSite: waypointTwo.id },
  selectedInputs: { units: 20 },
})
const renamedRelayRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_renamed_composed_attack_move",
  name: "Test Renamed Composed Attack Move",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [renamedRelayDefinition.id]: renamedRelayDefinition },
  actionPool: [
    ...TestRuleset.actionPool,
    { id: renamedRelayBusyAction.id, actionDefinitionId: renamedRelayDefinition.id },
    { id: renamedRelayDraftAction.id, actionDefinitionId: renamedRelayDefinition.id },
    { id: renamedRelayUnaffordableAction.id, actionDefinitionId: renamedRelayDefinition.id },
  ],
})
const renamedRelayJourney = createFleetStub({
  ...homeFleet,
  id: "fleet-renamed-siege-journey",
  name: "Home Guard",
  strength: 20,
  destinationPlanetId: waypoint.id,
  distanceToEnd: 2,
  movement: FleetMovementSchema.parse({
    speed: 2,
    departureTurn: 3,
    submission: renamedRelayCapturedSubmission,
    pendingArrivalEffects: [
      {
        effectDefinition: FleetAssaultEffectDefinition.create({ fleetTag: "originForce", planetTag: "landingSite" }),
        definitionOrdinal: 3,
      },
    ],
  }),
})
const renamedRelaySourceRemainder = createFleetStub({ ...homeFleet, strength: 30 })
const renamedRelayPlayerView = {
  ...attackMovePlayerView,
  resources: {
    ...attackMovePlayerView.resources,
    [ResourceType.INFLUENCE]: { total: 23, uncommitted: 23 },
    [ResourceType.FUEL]: { total: 8, uncommitted: 8 },
  },
  ruleset: renamedRelayRuleset,
  actions: [toActionDto(renamedRelayDraftAction, false)],
  fleets: [homeFleet, northernFleet],
} satisfies PlayerView
const renamedRelayProjection = createEligibilityState(renamedRelayPlayerView)
if (!renamedRelayProjection.success) {
  throw new Error(renamedRelayProjection.message)
}
const renamedRelayInProgressPlayerView = {
  ...renamedRelayPlayerView,
  actions: [toActionDto(renamedRelayBusyAction, true)],
  fleets: [renamedRelayJourney, renamedRelaySourceRemainder],
} satisfies PlayerView
const renamedRelayInProgressProjection = createEligibilityState(renamedRelayInProgressPlayerView)
if (!renamedRelayInProgressProjection.success) {
  throw new Error(renamedRelayInProgressProjection.message)
}
const renamedRelayUnaffordablePlayerView = {
  ...renamedRelayPlayerView,
  resources: {
    ...renamedRelayPlayerView.resources,
    [ResourceType.INFLUENCE]: { total: 6, uncommitted: 6 },
    [ResourceType.FUEL]: { total: 1, uncommitted: 1 },
  },
  actions: [toActionDto(renamedRelayBusyAction, true), toActionDto(renamedRelayUnaffordableAction, false)],
  fleets: [renamedRelayJourney, renamedRelaySourceRemainder, northernFleet],
} satisfies PlayerView
const renamedRelayUnaffordableProjection = createEligibilityState(renamedRelayUnaffordablePlayerView)
if (!renamedRelayUnaffordableProjection.success) {
  throw new Error(renamedRelayUnaffordableProjection.message)
}
const arbitraryTagActionDefinition = ActionDefinitionSchema.parse({
  ...MoveFleetStandard,
  id: "ARBITRARY_TAG_MOVE",
  name: "Arbitrary tag movement",
  inputs: { constructor: { type: "POSITIVE_INTEGER", label: "Units" } },
  targets: {
    constructor: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    landingSite: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "constructor", maxDistance: 5 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "constructor" }),
      ],
    },
  },
  effects: [
    FleetMoveEffectDefinition.create({
      fleetTag: "constructor",
      planetTag: "landingSite",
      strengthTag: "constructor",
      speed: 0.1,
    }),
  ],
})
const arbitraryTagAction = createAvailableActionStub({
  id: "ARBITRARY_TAG_MOVE_1",
  playerId: player.id,
  actionDefinitionId: arbitraryTagActionDefinition.id,
})
const arbitraryTagRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_arbitrary_prototype_key",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [arbitraryTagActionDefinition.id]: arbitraryTagActionDefinition },
  actionPool: [...TestRuleset.actionPool, { id: arbitraryTagAction.id, actionDefinitionId: arbitraryTagActionDefinition.id }],
})
const arbitraryTagPlayerView = {
  ...playerView,
  fleets: [homeFleet, northernFleet],
  ruleset: arbitraryTagRuleset,
  actions: [toActionDto(arbitraryTagAction, false)],
} satisfies PlayerView
const arbitraryTagProjection = createEligibilityState(arbitraryTagPlayerView)
if (!arbitraryTagProjection.success) {
  throw new Error(arbitraryTagProjection.message)
}

const exceptionalOrigin = createPlanetStub({
  id: "exceptional-origin",
  ownerPlayerId: player.id,
  name: "Exceptional Origin",
  coordinates: "0:0:0",
  x: 0,
  y: 0,
})
const exceptionalBoundary = createPlanetStub({
  id: "exceptional-boundary",
  ownerPlayerId: null,
  name: "Range Edge",
  coordinates: "25:0:0",
  x: 25,
  y: 0,
})
const exceptionalInside = createPlanetStub({
  id: "exceptional-inside",
  ownerPlayerId: null,
  name: "Inside Edge",
  coordinates: "24:0:0",
  x: 24,
  y: 0,
})
const exceptionalOutside = createPlanetStub({
  id: "exceptional-outside",
  ownerPlayerId: null,
  name: "Beyond Edge",
  coordinates: "25.001:0:0",
  x: 25.001,
  y: 0,
})
const exceptionalFleet = createFleetStub({
  id: "exceptional-source-fleet",
  ownerPlayerId: player.id,
  name: "Exceptional Source",
  strength: 50,
  originPlanetId: exceptionalOrigin.id,
})
const exceptionalAction = createAvailableActionStub({
  id: "MOVE_FLEET_EXCEPTIONAL_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetExceptional.id,
})
const exceptionalPlayerView = {
  ...playerView,
  galaxy: {
    systems: [
      {
        star: createStarStub({ id: "exceptional-star", name: "Exceptional System", coordinates: "0:0", x: 0, y: 0 }),
        planets: [exceptionalOrigin, exceptionalBoundary, exceptionalInside, exceptionalOutside],
      },
    ],
  },
  fleets: [exceptionalFleet],
  resources: {
    ...playerView.resources,
    [ResourceType.INFLUENCE]: { total: 3, uncommitted: 3 },
    [ResourceType.FUEL]: { total: 5, uncommitted: 5 },
  },
  ruleset: TestRuleset,
  actions: [toActionDto(exceptionalAction, false)],
} satisfies PlayerView
const exceptionalProjection = createEligibilityState(exceptionalPlayerView)
if (!exceptionalProjection.success) {
  throw new Error(exceptionalProjection.message)
}

const meta = {
  title: "Application/Action Card",
  component: ActionCard,
  args: {
    actionDefinition: MoveFleetStandard,
    action: actionForCard,
    playerView,
    players,
    ruleset: frontendProjection.ruleset,
    eligibilityState: frontendProjection.eligibilityState,
    disabled: false,
    onSelect: (): void => {},
  },
} satisfies Meta<typeof ActionCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Replacing the source fleet clears a now-invalid destination and recalculates the partial allocation.
 */
export const PartialMovementAllocation: Story = {
  render: function Render(args): ReactElement {
    const [action, setAction] = useState(args.action)
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          action={action}
          onSelect={(selectedTargets, selectedInputs) => {
            setAction({ ...action, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const fleetPicker = canvas.getByRole("combobox", { name: "Fleet target" })
    await userEvent.click(fleetPicker)
    await userEvent.click(body.getByRole("option", { name: "Home Guard (50 strength)" }))

    const planetPicker = canvas.getByRole("combobox", { name: "Planet target" })
    await expect(planetPicker).toHaveValue("")
    await userEvent.click(planetPicker)
    await expect(body.getByRole("option", { name: "Inner Reach (4:0:0)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Far Reach (14:0:0)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Inner Reach (4:0:0)" }))

    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    await userEvent.type(strengthInput, "20")
    await userEvent.click(fleetPicker)
    await userEvent.click(body.getByRole("option", { name: "Northern Guard (30 strength)" }))
    await expect(planetPicker).toHaveValue("Far Reach (14:0:0)")
    await expect(canvas.getByText("10 of 30 strength available after this allocation")).toBeVisible()

    const selectButton = canvas.getByRole("button", { name: "Select action" })
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeVisible()
    await expect(canvas.getByText("10 of 30 strength available after this allocation")).toBeVisible()
  },
}

/**
 * A Standard partial draft shares the API/resolution oracle with an existing Improved allocation.
 */
export const MixedDefinitionParity: Story = {
  render: function Render(args): ReactElement {
    const [action, setAction] = useState(() => toActionDto(parityStandardAction, false))
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          actionDefinition={MoveFleetStandard}
          action={action}
          playerView={parityPlayerView}
          ruleset={parityProjection.ruleset}
          eligibilityState={parityProjection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            setAction({ ...action, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const fleetPicker = canvas.getByRole("combobox", { name: "Fleet target" })
    const planetPicker = canvas.getByRole("combobox", { name: "Planet target" })
    await expect(fleetPicker).toHaveValue("Parity Source (50 strength)")
    await expect(planetPicker).toHaveValue("")
    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    const selectButton = canvas.getByRole("button", { name: "Select action" })
    await expect(selectButton).toBeDisabled()
    await userEvent.type(strengthInput, String(FleetActionSelectionParity.standardStrength))
    await expect(selectButton).toBeDisabled()
    await userEvent.click(planetPicker)
    await expect(body.getByRole("option", { name: "Parity Reach (55:07:50)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Parity Nearby (45:98:35)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Parity Improved Reach (52:98:30)" })).not.toBeInTheDocument()
    await expect(body.queryByRole("option", { name: "Parity Far Reach (90:90:90)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Parity Reach (55:07:50)" }))

    await expect(canvas.getByText("0 of 50 strength available after this allocation")).toBeVisible()
    await expect(selectButton).toBeEnabled()
    await userEvent.clear(strengthInput)
    await expect(selectButton).toBeDisabled()
    await userEvent.type(strengthInput, "1.5")
    await expect(selectButton).toBeDisabled()
    await userEvent.clear(strengthInput)
    await userEvent.type(strengthInput, String(FleetActionSelectionParity.standardStrength))
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)

    await expect(canvas.getByRole("button", { name: "Update action" })).toBeVisible()
    await expect(strengthInput).toHaveValue(FleetActionSelectionParity.standardStrength)
    await expect(planetPicker).toHaveValue("Parity Reach (55:07:50)")
  },
}

/**
 * An ordinary Move and Attack Move share the same source reservation and resource pool.
 */
export const ComposedReservationParity: Story = {
  render: (): ReactElement => <ComposedReservationCards />,
  args: {
    actionDefinition: MoveFleetStandard,
    action: toActionDto(composedMoveAction, false),
    playerView: composedReservationPlayerView,
    players,
    ruleset: TestRuleset,
    eligibilityState: parityProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const moveCard = within(canvas.getByRole("group", { name: "Move Fleet action" }))
    const attackCard = within(canvas.getByRole("group", { name: "Attack Move action" }))

    const moveFleetPicker = moveCard.getByRole("combobox", { name: "Fleet target" })
    const movePlanetPicker = moveCard.getByRole("combobox", { name: "Planet target" })
    const moveStrengthInput = moveCard.getByRole("spinbutton", { name: "Fleet strength" })
    await expect(moveFleetPicker).toHaveValue("Parity Source (50 strength)")
    await userEvent.click(movePlanetPicker)
    await userEvent.click(body.getByRole("option", { name: "Parity Reach (55:07:50)" }))
    await userEvent.type(moveStrengthInput, "20")
    await userEvent.click(moveCard.getByRole("button", { name: "Select action" }))

    const attackFleetPicker = attackCard.getByRole("combobox", { name: "Fleet target" })
    const attackPlanetPicker = attackCard.getByRole("combobox", { name: "Planet target" })
    const attackStrengthInput = attackCard.getByRole("spinbutton", { name: "Fleet strength" })
    await expect(attackFleetPicker).toHaveValue("Parity Source (50 strength)")
    await userEvent.click(attackPlanetPicker)
    await userEvent.click(body.getByRole("option", { name: "Parity Reach (55:07:50)" }))
    await userEvent.type(attackStrengthInput, "30")
    await expect(attackCard.getByText("0 of 50 strength available after this allocation")).toBeVisible()
    await userEvent.click(attackCard.getByRole("button", { name: "Select action" }))

    await expect(moveCard.getByText("0 of 50 strength available after this allocation")).toBeVisible()
    await expect(attackCard.getByText("0 of 50 strength available after this allocation")).toBeVisible()
    await expect(moveCard.getByLabelText("3 Influence")).toBeVisible()
    await expect(moveCard.getByLabelText("1 Fuel")).toBeVisible()
    await expect(attackCard.getByLabelText("5 Influence")).toBeVisible()
    await expect(attackCard.getByLabelText("1 Fuel")).toBeVisible()
    const partialCandidate = canvas.getByTestId("composed-partial-attack-candidate").textContent
    await expect(JSON.parse(partialCandidate ?? "null")).toStrictEqual({
      status: "INELIGIBLE",
      candidateStatus: "INELIGIBLE",
      candidateIssues: ["INSUFFICIENT_STRENGTH"],
      missingTargets: ["planet"],
      missingInputs: ["strength"],
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

    await userEvent.clear(attackStrengthInput)
    await userEvent.type(attackStrengthInput, "31")
    await expect(attackCard.getByRole("list")).toHaveTextContent("The selected Fleet has 50 Strength, but submitted Actions reserve 51")
    await expect(attackCard.getByRole("button", { name: "Update action" })).toBeDisabled()
    await userEvent.clear(attackStrengthInput)
    await userEvent.type(attackStrengthInput, "30")
    await expect(attackCard.getByRole("button", { name: "Update action" })).toBeEnabled()
    await userEvent.click(attackCard.getByRole("button", { name: "Update action" }))

    await userEvent.clear(moveStrengthInput)
    await userEvent.type(moveStrengthInput, "19")
    await expect(moveCard.getByText("1 of 50 strength available after this allocation")).toBeVisible()
    await userEvent.click(moveCard.getByRole("button", { name: "Update action" }))
    await userEvent.click(moveCard.getByRole("button", { name: "Cancel" }))
    await expect(attackStrengthInput).toHaveValue(30)
    await expect(attackCard.getByText("20 of 50 strength available after this allocation")).toBeVisible()
  },
}

/**
 * Clearing a selected partial allocation recomputes candidate feedback after excluding that edited Action instance.
 */
export const CommittedSourceCandidateFeedback: Story = {
  render: function Render(args): ReactElement {
    const draftAction = createSubmittedActionStub({
      ...currentAction,
      id: existingAllocation.id,
      selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
      selectedInputs: { strength: 20 },
    })
    const [editedAction, setEditedAction] = useState(() => toActionDto(draftAction, false))
    const reservedAction = createSubmittedActionStub({
      ...existingAllocation,
      id: currentAction.id,
      selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
      selectedInputs: { strength: 30 },
    })
    const candidateRuleset = Ruleset.create({
      ...storyRuleset,
      actionPool: storyRuleset.actionPool.map((entry) =>
        entry.id === currentAction.id
          ? { ...entry, id: existingAllocation.id }
          : entry.id === existingAllocation.id
            ? { ...entry, id: currentAction.id }
            : entry,
      ),
    })
    const reserveFleet = createFleetStub({
      id: "fleet-reserve-wing-candidate",
      ownerPlayerId: player.id,
      name: "Reserve Wing",
      strength: 12,
      originPlanetId: home.id,
    })
    const candidateAlternate = createPlanetStub({
      id: "planet-northern-alternate",
      ownerPlayerId: null,
      name: "Northern Alternate",
      coordinates: "15:0:0",
      x: 15,
      y: 0,
    })
    const candidateView: PlayerView = {
      ...playerView,
      galaxy: {
        systems: playerView.galaxy.systems.map((system) => ({
          ...system,
          planets: [...system.planets, candidateAlternate],
        })),
      },
      resources: {
        ...playerView.resources,
        [ResourceType.INFLUENCE]: { total: 20, uncommitted: 14 },
        [ResourceType.FUEL]: { total: 10, uncommitted: 8 },
      },
      ruleset: candidateRuleset,
      actions: [toActionDto(reservedAction, false), toActionDto(draftAction, false)],
      fleets: [homeFleet, northernFleet, reserveFleet],
    }
    const projection = createEligibilityState(candidateView)
    if (!projection.success) {
      throw new Error(projection.message)
    }
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          actionDefinition={MoveFleetStandard}
          action={editedAction}
          playerView={candidateView}
          ruleset={projection.ruleset}
          eligibilityState={projection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            if (selectedTargets === null || selectedInputs === null) {
              setEditedAction(toActionDto({ ...currentAction, id: draftAction.id }, false))
              return
            }
            setEditedAction({ ...editedAction, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  args: {
    actionDefinition: MoveFleetStandard,
    action: toActionDto(currentAction, false),
    playerView,
    players,
    ruleset: frontendProjection.ruleset,
    eligibilityState: frontendProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const fleetPicker = canvas.getByRole("combobox", { name: "Fleet target" })
    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    const updateButton = canvas.getByRole("button", { name: "Update action" })

    await expect(fleetPicker).toHaveValue("Home Guard (50 strength)")
    await expect(strengthInput).toHaveValue(20)
    await userEvent.clear(strengthInput)

    await expect(strengthInput).toHaveValue(null)
    await expect(canvas.getByText("20 of 50 strength available after this allocation")).toBeVisible()
    await expect(updateButton).toBeDisabled()
    await userEvent.click(fleetPicker)
    await expect(body.getByRole("option", { name: "Home Guard (50 strength)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Northern Guard (30 strength)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Reserve Wing (12 strength)" })).toBeVisible()
  },
}

/**
 * A fully reserved Fleet is unavailable to a fresh movement draft while other same-definition sources remain usable.
 */
export const FullyReservedSourceCandidate: Story = {
  render: function Render(args): ReactElement {
    const reservedHomeAction = createSubmittedActionStub({
      ...existingAllocation,
      selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
      selectedInputs: { strength: 50 },
    })
    const [draftAction, setDraftAction] = useState(() => toActionDto(currentAction, false))
    const reserveFleet = createFleetStub({
      id: "fleet-reserve-wing-fully-allocated-story",
      ownerPlayerId: player.id,
      name: "Reserve Wing",
      strength: 12,
      originPlanetId: home.id,
    })
    const candidateAlternate = createPlanetStub({
      id: "planet-northern-alternate-fully-reserved-story",
      ownerPlayerId: null,
      name: "Northern Alternate",
      coordinates: "12:0:0",
      x: 12,
      y: 0,
    })
    const candidateView: PlayerView = {
      ...playerView,
      galaxy: {
        systems: playerView.galaxy.systems.map((system) => ({
          ...system,
          planets: [...system.planets, candidateAlternate],
        })),
      },
      resources: {
        ...playerView.resources,
        [ResourceType.INFLUENCE]: { total: 20, uncommitted: 17 },
        [ResourceType.FUEL]: { total: 10, uncommitted: 9 },
      },
      actions: [toActionDto(currentAction, false), toActionDto(reservedHomeAction, false)],
      fleets: [homeFleet, northernFleet, reserveFleet],
    }
    const projection = createEligibilityState(candidateView)
    if (!projection.success) {
      throw new Error(projection.message)
    }
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          actionDefinition={MoveFleetStandard}
          action={draftAction}
          playerView={candidateView}
          ruleset={projection.ruleset}
          eligibilityState={projection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            if (selectedTargets === null || selectedInputs === null) {
              setDraftAction(toActionDto(currentAction, false))
              return
            }
            setDraftAction({ ...draftAction, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  args: {
    actionDefinition: MoveFleetStandard,
    action: toActionDto(currentAction, false),
    playerView,
    players,
    ruleset: frontendProjection.ruleset,
    eligibilityState: frontendProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const sourcePicker = canvas.getByRole("combobox", { name: "Fleet target" })
    const destinationPicker = canvas.getByRole("combobox", { name: "Planet target" })
    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    const selectButton = canvas.getByRole("button", { name: "Select action" })

    await expect(sourcePicker).toHaveValue("")
    await expect(destinationPicker).toHaveValue("")
    await expect(strengthInput).toHaveValue(null)
    await userEvent.click(sourcePicker)
    await expect(body.queryByRole("option", { name: "Home Guard (50 strength)" })).not.toBeInTheDocument()
    await expect(body.getByRole("option", { name: "Northern Guard (30 strength)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Reserve Wing (12 strength)" })).toBeVisible()
    await userEvent.click(body.getByRole("option", { name: "Northern Guard (30 strength)" }))

    await expect(sourcePicker).toHaveValue("Northern Guard (30 strength)")
    await expect(destinationPicker).toHaveValue("")
    await expect(strengthInput).toHaveValue(null)
    await expect(selectButton).toBeDisabled()
  },
}

/**
 * A fleet journey keeps its Action instance occupied until arrival.
 */
export const OccupiedDuringMovement: Story = {
  render: function Render(args): ReactElement {
    const historicalSource = createFleetStub({
      ...northernFleet,
      id: "fleet-northern-source",
      strength: 20,
    })
    const movement = FleetMovementSchema.parse({
      speed: 0.1,
      departureTurn: 3,
      submission: createSubmittedActionStub({
        id: currentAction.id,
        playerId: player.id,
        actionDefinitionId: MoveFleetStandard.id,
        selectedTargets: { fleet: historicalSource.id, planet: farReach.id },
        selectedInputs: { strength: 20 },
      }),
      pendingArrivalEffects: [],
    })
    const movingFleet = createFleetStub({
      ...northernFleet,
      id: "fleet-northern-journey",
      strength: 20,
      destinationPlanetId: farReach.id,
      distanceToEnd: 4,
      movement,
    })
    const freeSameDefinitionAction = createAvailableActionStub({
      id: "MOVE_FLEET_STANDARD_3",
      playerId: player.id,
      actionDefinitionId: MoveFleetStandard.id,
    })
    const [freeActionSelection, setFreeActionSelection] = useState(toActionDto(freeSameDefinitionAction, false))
    const secondStationaryFleet = createFleetStub({
      id: "fleet-reserve-wing",
      ownerPlayerId: player.id,
      name: "Reserve Wing",
      strength: 12,
      originPlanetId: home.id,
    })
    const occupiedRuleset = Ruleset.create({
      ...storyRuleset,
      actionPool: [...storyRuleset.actionPool, { id: freeSameDefinitionAction.id, actionDefinitionId: MoveFleetStandard.id }],
    })
    const occupiedView: PlayerView = {
      ...playerView,
      ruleset: occupiedRuleset,
      actions: [toActionDto(currentAction, true), toActionDto(freeSameDefinitionAction, false)],
      fleets: [homeFleet, secondStationaryFleet, movingFleet],
    }
    const occupiedProjection = createEligibilityState(occupiedView)
    if (!occupiedProjection.success) {
      throw new Error(occupiedProjection.message)
    }
    return (
      <div className="flex w-full flex-wrap gap-4">
        <ActionCard
          {...args}
          actionDefinition={MoveFleetStandard}
          action={toActionDto(currentAction, true)}
          playerView={occupiedView}
          ruleset={occupiedProjection.ruleset}
          eligibilityState={occupiedProjection.eligibilityState}
          disabled
        />
        <ActionCard
          {...args}
          actionDefinition={MoveFleetStandard}
          action={freeActionSelection}
          playerView={occupiedView}
          ruleset={occupiedProjection.ruleset}
          eligibilityState={occupiedProjection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            setFreeActionSelection({ ...freeActionSelection, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const actionCards = canvas.getAllByRole("group", { name: "Move Fleet action" })
    const occupiedCardElement = actionCards[0]
    const freeCardElement = actionCards[1]
    if (occupiedCardElement === undefined || freeCardElement === undefined) {
      throw new Error("Expected the occupied and free movement instances")
    }
    const occupiedCard = within(occupiedCardElement)
    const freeCard = within(freeCardElement)
    await expect(occupiedCard.getByRole("status", { name: "Fleet journey" })).toHaveTextContent(
      "Northern Guard · 20 strength · to Far Reach · 4 ly remaining",
    )
    await expect(occupiedCard.queryByRole("combobox")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("spinbutton")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("alert")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("list")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByText(/strength available after this allocation/)).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("button")).not.toBeInTheDocument()
    await expect(occupiedCardElement.querySelector('[aria-label="Costs"]')).toBeNull()
    const body = within(canvasElement.ownerDocument.body)
    const fleetPicker = freeCard.getByRole("combobox", { name: "Fleet target" })
    const planetPicker = freeCard.getByRole("combobox", { name: "Planet target" })
    const strengthInput = freeCard.getByRole("spinbutton", { name: "Fleet strength" })
    await expect(fleetPicker).toBeEnabled()
    await expect(strengthInput).toBeEnabled()
    await userEvent.click(fleetPicker)
    await userEvent.click(body.getByRole("option", { name: "Home Guard (50 strength)" }))
    await expect(planetPicker).toBeEnabled()
    await userEvent.click(planetPicker)
    await userEvent.click(body.getByRole("option", { name: "Waypoint (2:0:0)" }))
    await userEvent.type(strengthInput, "1")
    const selectButton = freeCard.getByRole("button", { name: "Select action" })
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(freeCard.getByRole("button", { name: "Update action" })).toBeVisible()
    await expect(fleetPicker).toHaveValue("Home Guard (50 strength)")
    await expect(planetPicker).toHaveValue("Waypoint (2:0:0)")
    await expect(strengthInput).toHaveValue(1)
  },
}

/**
 * A missing declared source key stays incomplete instead of reading Object's inherited constructor value.
 */
export const PrototypeSafeSelection: Story = {
  render: function Render(args): ReactElement {
    const [action, setAction] = useState(args.action)
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          action={action}
          onSelect={(selectedTargets, selectedInputs) => {
            setAction({ ...action, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  args: {
    actionDefinition: arbitraryTagActionDefinition,
    action: toActionDto(arbitraryTagAction, false),
    playerView: arbitraryTagPlayerView,
    players,
    ruleset: arbitraryTagProjection.ruleset,
    eligibilityState: arbitraryTagProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const sourcePicker = canvas.getByRole("combobox", { name: "Constructor target" })
    const destinationPicker = canvas.getByRole("combobox", { name: "Landing Site target" })
    const unitsInput = canvas.getByRole("spinbutton", { name: "Units" })
    const selectButton = canvas.getByRole("button", { name: "Select action" })

    await expect(sourcePicker).toHaveValue("")
    await expect(destinationPicker).toHaveValue("")
    await expect(unitsInput).toHaveValue(null)
    await expect(selectButton).toBeDisabled()

    await userEvent.click(sourcePicker)
    await userEvent.click(body.getByRole("option", { name: "Home Guard (50 strength)" }))
    await userEvent.click(destinationPicker)
    await expect(body.getByRole("option", { name: "Waypoint (2:0:0)" })).toBeVisible()
    await userEvent.click(body.getByRole("option", { name: "Waypoint (2:0:0)" }))
    await userEvent.type(unitsInput, "1")

    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeVisible()
    await expect(sourcePicker).toHaveValue("Home Guard (50 strength)")
    await expect(destinationPicker).toHaveValue("Waypoint (2:0:0)")
    await expect(unitsInput).toHaveValue(1)
  },
}

/**
 * Exceptional movement admits the inclusive 25 light-year endpoint and excludes the next 0.001 light-year.
 */
export const ExceptionalRangeBoundary: Story = {
  render: function Render(args): ReactElement {
    const [action, setAction] = useState(args.action)
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          action={action}
          onSelect={(selectedTargets, selectedInputs) => {
            setAction({ ...action, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  args: {
    actionDefinition: MoveFleetExceptional,
    action: toActionDto(exceptionalAction, false),
    playerView: exceptionalPlayerView,
    players,
    ruleset: exceptionalProjection.ruleset,
    eligibilityState: exceptionalProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const sourcePicker = canvas.getByRole("combobox", { name: "Fleet target" })
    const destinationPicker = canvas.getByRole("combobox", { name: "Planet target" })
    await expect(sourcePicker).toHaveValue("Exceptional Source (50 strength)")
    await userEvent.click(destinationPicker)
    await expect(body.getByRole("option", { name: "Range Edge (25:0:0)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Inside Edge (24:0:0)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Beyond Edge (25.001:0:0)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Range Edge (25:0:0)" }))

    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    await userEvent.type(strengthInput, "1")
    const selectButton = canvas.getByRole("button", { name: "Select action" })
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeVisible()
    await expect(destinationPicker).toHaveValue("Range Edge (25:0:0)")
  },
}

/**
 * Attack Move uses the shared eligibility draft for force, source, destination, affordability and cancellation.
 */
export const AttackMoveAssault: Story = {
  render: function Render(args): ReactElement {
    const [action, setAction] = useState(args.action)
    return (
      <div className="w-80">
        <ActionCard
          {...args}
          action={action}
          playerView={attackMovePlayerView}
          ruleset={attackMoveProjection.ruleset}
          eligibilityState={attackMoveProjection.eligibilityState}
          onSelect={(selectedTargets, selectedInputs) => {
            setAction({ ...action, selectedTargets, selectedInputs })
          }}
        />
      </div>
    )
  },
  args: {
    actionDefinition: AttackMoveTest,
    action: toActionDto(attackMoveAction, false),
    playerView: attackMovePlayerView,
    players,
    ruleset: attackMoveProjection.ruleset,
    eligibilityState: attackMoveProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)

    await expect(
      canvas.getByText(
        "Move a fleet to the target planet at 1 light year per turn, within a range of 5 light years. On arrival, join friendly fleets at the target, then attack all enemy fleets there in one simultaneous exchange.",
      ),
    ).toBeVisible()
    await expect(canvas.getByLabelText("5 Influence")).toBeVisible()
    await expect(canvas.getByLabelText("1 Fuel")).toBeVisible()

    const fleetPicker = canvas.getByRole("combobox", { name: "Fleet target" })
    const planetPicker = canvas.getByRole("combobox", { name: "Planet target" })
    const strengthInput = canvas.getByRole("spinbutton", { name: "Fleet strength" })
    const selectButton = canvas.getByRole("button", { name: "Select action" })
    await userEvent.click(fleetPicker)
    await userEvent.click(body.getByRole("option", { name: "Home Guard (50 strength)" }))
    await userEvent.click(planetPicker)
    await userEvent.click(body.getByRole("option", { name: "Waypoint (2:0:0)" }))
    await userEvent.type(strengthInput, "30")
    await expect(canvas.getByText("20 of 50 strength available after this allocation")).toBeVisible()
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeVisible()

    await userEvent.clear(strengthInput)
    await userEvent.type(strengthInput, "31")
    await expect(canvas.getByText("19 of 50 strength available after this allocation")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Update action" }))

    await userEvent.clear(strengthInput)
    await userEvent.type(strengthInput, "20")
    await userEvent.click(fleetPicker)
    await userEvent.click(body.getByRole("option", { name: "Northern Guard (30 strength)" }))
    await expect(planetPicker).toHaveValue("")
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(canvas.getByText("10 of 30 strength available after this allocation")).toBeVisible()
    await userEvent.click(planetPicker)
    await expect(body.getByRole("option", { name: "Far Reach (14:0:0)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Waypoint (2:0:0)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Far Reach (14:0:0)" }))
    await expect(selectButton).toBeEnabled()
    await userEvent.click(canvas.getByRole("button", { name: "Update action" }))
    await expect(planetPicker).toHaveValue("Far Reach (14:0:0)")
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }))
    await expect(planetPicker).toHaveValue("")
    await expect(strengthInput).toHaveValue(null)
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
  },
}

/**
 * Conjoined mapped range constraints disclose the strictest limit independent of their declaration order.
 */
export const ConjoinedRangeDisclosure: Story = {
  render: (): ReactElement => (
    <div className="flex flex-wrap gap-4">
      <ConjoinedRangeCard fixture={forwardConjoinedRangeFixture} />
      <ConjoinedRangeCard fixture={reversedConjoinedRangeFixture} />
    </div>
  ),
  args: {
    actionDefinition: AttackMoveTest,
    action: toActionDto(attackMoveAction, false),
    playerView: attackMovePlayerView,
    players,
    ruleset: attackMoveProjection.ruleset,
    eligibilityState: attackMoveProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, userEvent }): Promise<void> => {
    const disclosures = canvas.getAllByText(/within a range of 5 light years/)
    await expect(disclosures).toHaveLength(2)
    const fleetPickers = canvas.getAllByRole("combobox", { name: "Fleet target" })
    const planetPickers = canvas.getAllByRole("combobox", { name: "Planet target" })
    const strengthInputs = canvas.getAllByRole("spinbutton", { name: "Fleet strength" })
    const selectButtons = canvas.getAllByRole("button", { name: "Select action" })
    await expect(fleetPickers).toHaveLength(2)
    await expect(planetPickers).toHaveLength(2)
    for (const [index, strengthInput] of strengthInputs.entries()) {
      const fleetPicker = fleetPickers[index]
      const planetPicker = planetPickers[index]
      const selectButton = selectButtons[index]
      if (fleetPicker === undefined || planetPicker === undefined || selectButton === undefined) {
        throw new Error("Both conjoined-range cards must expose their selection controls")
      }
      await expect(fleetPicker).toHaveValue("Home Guard (50 strength)")
      await expect(planetPicker).toHaveValue("Range Edge (5:0:0)")
      await userEvent.type(strengthInput, "30")
      await expect(selectButton).toBeEnabled()
    }
  },
}
/**
 * A composed journey keeps its captured target and future Assault visible while the Action instance is occupied.
 */
export const AttackMoveJourneyInProgress: Story = {
  render: function Render(args): ReactElement {
    const projection = createEligibilityState(args.playerView)
    if (!projection.success) {
      throw new Error(projection.message)
    }
    return (
      <div className="w-80">
        <ActionCard {...args} ruleset={projection.ruleset} eligibilityState={projection.eligibilityState} />
      </div>
    )
  },
  args: {
    actionDefinition: AttackMoveTest,
    action: toActionDto(attackMoveAction, true),
    playerView: {
      ...attackMovePlayerView,
      fleets: [
        createFleetStub({
          ...homeFleet,
          id: "fleet-attack-journey",
          name: "Home Guard",
          strength: 30,
          destinationPlanetId: waypoint.id,
          distanceToEnd: 2,
          movement: FleetMovementSchema.parse({
            speed: 1,
            departureTurn: 4,
            submission: createSubmittedActionStub({
              id: attackMoveAction.id,
              playerId: player.id,
              actionDefinitionId: AttackMoveTest.id,
              selectedTargets: { fleet: homeFleet.id, planet: waypoint.id },
              selectedInputs: { strength: 30 },
            }),
            pendingArrivalEffects: [
              { effectDefinition: FleetAssaultEffectDefinition.create({ fleetTag: "fleet", planetTag: "planet" }), definitionOrdinal: 3 },
            ],
          }),
        }),
      ],
    },
  },
  play: async ({ canvas, args }) => {
    const projection = createEligibilityState(args.playerView)
    if (!projection.success) {
      throw new Error(projection.message)
    }
    const bindingEvaluation = evaluateSubmittedActions({
      state: projection.eligibilityState,
      ruleset: projection.ruleset,
      submissions: [],
    })
    await expect(bindingEvaluation.status).toBe("ELIGIBLE")
    await expect(bindingEvaluation.issues).not.toContainEqual(expect.objectContaining({ code: "INVALID_MOVEMENT_BINDING" }))
    const card = within(canvas.getByRole("group", { name: "Attack Move action" }))
    await expect(card.getByText(/On arrival, join friendly fleets at the target/)).toBeVisible()
    await expect(card.getByRole("status", { name: "Fleet journey" })).toHaveTextContent(
      "Home Guard · 30 strength · to Waypoint · 2 ly remaining",
    )
    await expect(card.queryByRole("combobox")).not.toBeInTheDocument()
    await expect(card.queryByRole("spinbutton")).not.toBeInTheDocument()
    await expect(card.queryByRole("button")).not.toBeInTheDocument()
  },
}
/**
 * A renamed composed definition keeps the mapped force, landing site, capture, costs, and range readable and interactive.
 */
export const RenamedComposedAttackMove: Story = {
  render: function Render(): ReactElement {
    const [draftAction, setDraftAction] = useState(toActionDto(renamedRelayDraftAction, false))
    return (
      <div className="flex w-full flex-wrap gap-4">
        <ActionCard
          actionDefinition={renamedRelayDefinition}
          action={toActionDto(renamedRelayBusyAction, true)}
          playerView={renamedRelayInProgressPlayerView}
          players={players}
          ruleset={renamedRelayInProgressProjection.ruleset}
          eligibilityState={renamedRelayInProgressProjection.eligibilityState}
          disabled={false}
          onSelect={() => undefined}
        />
        <ActionCard
          actionDefinition={renamedRelayDefinition}
          action={draftAction}
          playerView={renamedRelayPlayerView}
          players={players}
          ruleset={renamedRelayProjection.ruleset}
          eligibilityState={renamedRelayProjection.eligibilityState}
          disabled={false}
          onSelect={(selectedTargets, selectedInputs) => {
            setDraftAction({ ...draftAction, selectedTargets, selectedInputs })
          }}
        />
        <ActionCard
          actionDefinition={renamedRelayDefinition}
          action={toActionDto(renamedRelayUnaffordableAction, false)}
          playerView={renamedRelayUnaffordablePlayerView}
          players={players}
          ruleset={renamedRelayUnaffordableProjection.ruleset}
          eligibilityState={renamedRelayUnaffordableProjection.eligibilityState}
          disabled={false}
          onSelect={() => undefined}
        />
      </div>
    )
  },
  args: {
    actionDefinition: renamedRelayDefinition,
    action: toActionDto(renamedRelayDraftAction, false),
    playerView: renamedRelayPlayerView,
    players,
    ruleset: renamedRelayProjection.ruleset,
    eligibilityState: renamedRelayProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const cards = canvas.getAllByRole("group", { name: "Siege Relay action" })
    const occupiedCardElement = cards[0]
    const editableCardElement = cards[1]
    const unaffordableCardElement = cards[2]
    if (occupiedCardElement === undefined || editableCardElement === undefined || unaffordableCardElement === undefined) {
      throw new Error("Expected the captured, editable, and unaffordable Siege Relay instances")
    }
    const occupiedCard = within(occupiedCardElement)
    const editableCard = within(editableCardElement)
    const unaffordableCard = within(unaffordableCardElement)
    await expect(occupiedCard.getByRole("status", { name: "Fleet journey" })).toHaveTextContent(
      "Home Guard · 20 strength · to Waypoint · 2 ly remaining",
    )
    await expect(occupiedCard.queryByRole("combobox")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("spinbutton")).not.toBeInTheDocument()
    await expect(occupiedCard.queryByRole("button")).not.toBeInTheDocument()
    await expect(editableCard.getByText("Exceptional Directive")).toBeVisible()
    await expect(
      editableCard.getByText(
        "Move a fleet to the target planet at 2 light years per turn, within a range of 5 light years. On arrival, join friendly fleets at the target, then attack all enemy fleets there in one simultaneous exchange.",
      ),
    ).toBeVisible()
    await expect(editableCard.getByLabelText("7 Influence")).toBeVisible()
    await expect(editableCard.getByLabelText("2 Fuel")).toBeVisible()
    await expect(unaffordableCard.getByText("Missing 1 INFLUENCE")).toBeVisible()
    await expect(unaffordableCard.getByText("Missing 1 FUEL")).toBeVisible()
    await expect(unaffordableCard.getByText("10 of 30 strength available after this allocation")).toBeVisible()
    await expect(unaffordableCard.getByLabelText("7 Influence, cannot afford")).toBeVisible()
    await expect(unaffordableCard.getByLabelText("2 Fuel, cannot afford")).toBeVisible()
    await expect(unaffordableCard.getByRole("button", { name: "Update action" })).toBeDisabled()

    const body = within(canvasElement.ownerDocument.body)
    const originPicker = editableCard.getByRole("combobox", { name: "Origin Force target" })
    const landingPicker = editableCard.getByRole("combobox", { name: "Landing Site target" })
    const unitsInput = editableCard.getByRole("spinbutton", { name: "Units" })
    await expect(originPicker).toHaveValue("")
    await expect(landingPicker).toHaveValue("")
    await expect(unitsInput).toHaveValue(null)
    await userEvent.click(originPicker)
    await userEvent.click(body.getByRole("option", { name: "Home Guard (50 strength)" }))
    await userEvent.click(landingPicker)
    await userEvent.click(body.getByRole("option", { name: "Inner Reach (4:0:0)" }))
    await userEvent.type(unitsInput, "20")
    await expect(editableCard.getByText("30 of 50 strength available after this allocation")).toBeVisible()
    const selectButton = editableCard.getByRole("button", { name: "Select action" })
    await expect(selectButton).toBeEnabled()
    await userEvent.click(selectButton)
    await expect(editableCard.getByRole("button", { name: "Update action" })).toBeEnabled()

    await userEvent.clear(unitsInput)
    await userEvent.type(unitsInput, "21")
    await expect(editableCard.getByText("29 of 50 strength available after this allocation")).toBeVisible()
    await userEvent.click(originPicker)
    await userEvent.click(body.getByRole("option", { name: "Northern Guard (30 strength)" }))
    await expect(landingPicker).toHaveValue("")
    await expect(editableCard.getByRole("button", { name: "Update action" })).toBeDisabled()
    await userEvent.click(landingPicker)
    await expect(body.getByRole("option", { name: "Northern Reach (15:0:0)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Inner Reach (4:0:0)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Northern Reach (15:0:0)" }))
    await expect(editableCard.getByRole("button", { name: "Update action" })).toBeEnabled()
    await userEvent.click(editableCard.getByRole("button", { name: "Update action" }))
    await userEvent.click(editableCard.getByRole("button", { name: "Cancel" }))
    await expect(originPicker).toHaveValue("")
    await expect(landingPicker).toHaveValue("")
    await expect(unitsInput).toHaveValue(null)
    await expect(editableCard.getByRole("button", { name: "Select action" })).toBeDisabled()
  },
}
function toActionDto(action: Omit<Action, "canAfford" | "isInProgress">, isInProgress: boolean): Action {
  return { ...action, canAfford: true, isInProgress }
}
