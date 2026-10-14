import type { Action, PlayerView } from "@api-types"
import { branded, type DeepUnbranded } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ReactElement, useState } from "react"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema, type ActionDefinition } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { ActionInputDefinition } from "shared/domain/ruleset/action-definitions/ActionInputDefinition.ts"
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
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import {
  requireEligibilityProjection,
  toActionDto,
  player,
  home,
  waypoint,
  waypointTwo,
  homeFleet,
  northernFleet,
  playerView,
  players,
  attackMovePlayerView,
} from "./ActionCard.selection-fixture.tsx"
import { ActionCard } from "./ActionCard.tsx"
import type { createEligibilityState } from "./ActionSelector.tsx"

export type ConjoinedRangeProjection = Extract<ReturnType<typeof createEligibilityState>, { success: true }>

export type ConjoinedRangeFixture = Readonly<{
  actionDefinition: ActionDefinition
  action: Action
  playerView: PlayerView
  projection: ConjoinedRangeProjection
}>

export const assaultRangeBoundary = createPlanetStub({
  id: "planet-assault-range-boundary",
  name: "Range Edge",
  coordinates: "5:0:0",
  x: 5,
  y: 0,
})

export function createConjoinedRangeFixture({
  id,
  name,
  rangeLimits,
}: {
  id: string
  name: string
  rangeLimits: readonly [number, number]
}): ConjoinedRangeFixture {
  const actionDefinition = typedParse(ActionDefinitionSchema, {
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
  const projection = requireEligibilityProjection(view)

  return { actionDefinition, action: toActionDto(action, false), playerView: view, projection }
}

export const forwardConjoinedRangeFixture = createConjoinedRangeFixture({
  id: "TEST_CONJOINED_RANGE_FORWARD",
  name: "Conjoined Range Forward",
  rangeLimits: [10, 5],
})

export const reversedConjoinedRangeFixture = createConjoinedRangeFixture({
  id: "TEST_CONJOINED_RANGE_REVERSED",
  name: "Conjoined Range Reversed",
  rangeLimits: [5, 10],
})

export function ConjoinedRangeCard({ fixture }: { fixture: ConjoinedRangeFixture }): ReactElement {
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

export const renamedRelayDefinition = typedParse(ActionDefinitionSchema, {
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

export const renamedRelayCapturedSubmission = createSubmittedActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_1",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
  selectedTargets: { originForce: homeFleet.id, landingSite: waypoint.id },
  selectedInputs: { units: 20 },
})

export const renamedRelayBusyAction = {
  ...createAvailableActionStub({
    id: renamedRelayCapturedSubmission.id,
    playerId: player.id,
    actionDefinitionId: renamedRelayDefinition.id,
  }),
  selectedTargets: null,
  selectedInputs: null,
}

export const renamedRelayDraftAction = createAvailableActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_2",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
})

export const renamedRelayUnaffordableAction = createSubmittedActionStub({
  id: "TEST_RENAMED_SIEGE_RELAY_3",
  playerId: player.id,
  actionDefinitionId: renamedRelayDefinition.id,
  selectedTargets: { originForce: homeFleet.id, landingSite: waypointTwo.id },
  selectedInputs: { units: 20 },
})

export const renamedRelayRuleset = Ruleset.create({
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

export const renamedRelayJourney = createFleetStub({
  ...homeFleet,
  id: "fleet-renamed-siege-journey",
  name: "Home Guard",
  strength: 20,
  destinationPlanetId: waypoint.id,
  distanceToEnd: 2,
  movement: typedParse(FleetMovementSchema, {
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

export const renamedRelaySourceRemainder = createFleetStub({ ...homeFleet, strength: 30 })

export const renamedRelayPlayerView = {
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

export const renamedRelayProjection = requireEligibilityProjection(renamedRelayPlayerView)

export const renamedRelayInProgressPlayerView = {
  ...renamedRelayPlayerView,
  actions: [toActionDto(renamedRelayBusyAction, true)],
  fleets: [renamedRelayJourney, renamedRelaySourceRemainder],
} satisfies PlayerView

export const renamedRelayInProgressProjection = requireEligibilityProjection(renamedRelayInProgressPlayerView)

export const renamedRelayUnaffordablePlayerView = {
  ...renamedRelayPlayerView,
  resources: {
    ...renamedRelayPlayerView.resources,
    [ResourceType.INFLUENCE]: { total: 6, uncommitted: 6 },
    [ResourceType.FUEL]: { total: 1, uncommitted: 1 },
  },
  actions: [toActionDto(renamedRelayBusyAction, true), toActionDto(renamedRelayUnaffordableAction, false)],
  fleets: [renamedRelayJourney, renamedRelaySourceRemainder, northernFleet],
} satisfies PlayerView

export const renamedRelayUnaffordableProjection = requireEligibilityProjection(renamedRelayUnaffordablePlayerView)

export const arbitraryTagActionInput: ActionInputDefinition = { type: "POSITIVE_INTEGER", label: "Units" }

export const arbitraryTagActionDefinitionInput: DeepUnbranded<ActionDefinition> = {
  ...MoveFleetStandard,
  id: "ARBITRARY_TAG_MOVE",
  name: "Arbitrary tag movement",
  inputs: { constructor: arbitraryTagActionInput },
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
}

export const arbitraryTagActionDefinition = typedParse(ActionDefinitionSchema, arbitraryTagActionDefinitionInput)

export const arbitraryTagAction = createAvailableActionStub({
  id: "ARBITRARY_TAG_MOVE_1",
  playerId: player.id,
  actionDefinitionId: arbitraryTagActionDefinition.id,
})

export const arbitraryTagRuleset = Ruleset.create({
  ...TestRuleset,
  id: "test_arbitrary_prototype_key",
  actionDefinitions: { ...TestRuleset.actionDefinitions, [arbitraryTagActionDefinition.id]: arbitraryTagActionDefinition },
  actionPool: [...TestRuleset.actionPool, { id: arbitraryTagAction.id, actionDefinitionId: arbitraryTagActionDefinition.id }],
})

export const arbitraryTagPlayerView = {
  ...playerView,
  fleets: [homeFleet, northernFleet],
  ruleset: arbitraryTagRuleset,
  actions: [toActionDto(arbitraryTagAction, false)],
} satisfies PlayerView

export const arbitraryTagProjection = requireEligibilityProjection(arbitraryTagPlayerView)

export const exceptionalOrigin = createPlanetStub({
  id: "exceptional-origin",
  ownerPlayerId: player.id,
  name: "Exceptional Origin",
  coordinates: "0:0:0",
  x: 0,
  y: 0,
})

export const exceptionalBoundary = createPlanetStub({
  id: "exceptional-boundary",
  ownerPlayerId: null,
  name: "Range Edge",
  coordinates: "25:0:0",
  x: 25,
  y: 0,
})

export const exceptionalInside = createPlanetStub({
  id: "exceptional-inside",
  ownerPlayerId: null,
  name: "Inside Edge",
  coordinates: "24:0:0",
  x: 24,
  y: 0,
})

export const exceptionalOutside = createPlanetStub({
  id: "exceptional-outside",
  ownerPlayerId: null,
  name: "Beyond Edge",
  coordinates: "25.001:0:0",
  x: 25.001,
  y: 0,
})

export const exceptionalFleet = createFleetStub({
  id: "exceptional-source-fleet",
  ownerPlayerId: player.id,
  name: "Exceptional Source",
  strength: 50,
  originPlanetId: exceptionalOrigin.id,
})

export const exceptionalAction = createAvailableActionStub({
  id: "MOVE_FLEET_EXCEPTIONAL_1",
  playerId: player.id,
  actionDefinitionId: MoveFleetExceptional.id,
})

export const exceptionalPlayerView = {
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

export const exceptionalProjection = requireEligibilityProjection(exceptionalPlayerView)
