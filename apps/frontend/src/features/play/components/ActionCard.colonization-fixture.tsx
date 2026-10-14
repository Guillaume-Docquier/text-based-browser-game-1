import type { PlayerView } from "@api-types"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { type ReactElement, useState } from "react"
import { evaluateSubmittedActions } from "shared/action-submission/evaluateActionSelection.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { ActionTier } from "shared/domain/ruleset/action-definitions/ActionTier.ts"
import { FleetColonizeEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetColonizeEffectDefinition.ts"
import { FleetMoveEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetMoveEffectDefinition.ts"
import { ResourceLossEffectDefinition } from "shared/domain/ruleset/effect-definitions/ResourceLossEffectDefinition.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { DifferentFromFleetOriginConstraint } from "shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraint } from "shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { UnclaimedPlanetConstraint } from "shared/domain/ruleset/target-definitions/UnclaimedPlanetTargetConstraint.ts"
import { WithinFleetRangeConstraint } from "shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"
import { createAvailableActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import type { SubmittedAction } from "shared/domain/turns/actions/Action.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createStarStub } from "shared/domain/world/stars/Star.stub.ts"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { requireEligibilityProjection, toActionDto, player, home, waypoint, playerView, players } from "./ActionCard.selection-fixture.tsx"
import { ActionCard } from "./ActionCard.tsx"

export const colonizeThresholdFleet = createFleetStub({
  id: "fleet-colonize-threshold",
  ownerPlayerId: player.id,
  name: "Threshold Guard",
  strength: 100,
  originPlanetId: home.id,
})

export const colonizeThresholdAction = createAvailableActionStub({
  id: "COLONIZE_PLANET_THRESHOLD_STORY",
  playerId: player.id,
  actionDefinitionId: ColonizePlanetTest.id,
})

export const colonizeThresholdRuleset = Ruleset.create({
  ...TestRuleset,
  actionPool: [...TestRuleset.actionPool, { id: colonizeThresholdAction.id, actionDefinitionId: ColonizePlanetTest.id }],
})

export const colonizeThresholdPlayerView = {
  ...playerView,
  galaxy: {
    systems: [
      {
        star: createStarStub({ id: "colonize-threshold-star", name: "Threshold System", coordinates: "0:0", x: 0, y: 0 }),
        planets: [home, waypoint],
      },
    ],
  },
  fleets: [colonizeThresholdFleet],
  resources: {
    ...playerView.resources,
    [ResourceType.INFLUENCE]: { total: 25, uncommitted: 25 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
  },
  ruleset: colonizeThresholdRuleset,
  actions: [toActionDto(colonizeThresholdAction, false)],
} satisfies PlayerView

export const colonizeThresholdProjection = requireEligibilityProjection(colonizeThresholdPlayerView)

export function ColonizeThresholdCard(): ReactElement {
  const [action, setAction] = useState(() => toActionDto(colonizeThresholdAction, false))
  const currentPlayerView = { ...colonizeThresholdPlayerView, actions: [action] }
  const projection = requireEligibilityProjection(currentPlayerView)

  return (
    <div className="w-80">
      <output data-testid="colonize-threshold-selection" className="sr-only">
        {JSON.stringify({ selectedTargets: action.selectedTargets, selectedInputs: action.selectedInputs })}
      </output>
      <ActionCard
        actionDefinition={ColonizePlanetTest}
        action={action}
        playerView={currentPlayerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setAction({ ...action, selectedTargets, selectedInputs })
        }}
      />
    </div>
  )
}

export const stationaryColonizeFleet = createFleetStub({
  id: "fleet-stationary-colonize",
  ownerPlayerId: player.id,
  name: "Wayfinder Guard",
  strength: 35,
  originPlanetId: waypoint.id,
})

export const stationaryColonizeMoveAction = createAvailableActionStub({
  id: "MOVE_FLEET_STANDARD_COLONIZE_STORY",
  playerId: player.id,
  actionDefinitionId: MoveFleetStandard.id,
})

export const stationaryColonizeAction = createAvailableActionStub({
  id: "COLONIZE_HERE_STORY",
  playerId: player.id,
  actionDefinitionId: ColonizeHereTest.id,
})

export const stationaryColonizePlayerView = {
  ...playerView,
  fleets: [stationaryColonizeFleet],
  resources: {
    ...playerView.resources,
    [ResourceType.INFLUENCE]: { total: 100, uncommitted: 100 },
    [ResourceType.FUEL]: { total: 10, uncommitted: 10 },
  },
  actions: [toActionDto(stationaryColonizeMoveAction, false), toActionDto(stationaryColonizeAction, false)],
} satisfies PlayerView

export const stationaryColonizeProjection = requireEligibilityProjection(stationaryColonizePlayerView)

export function StationaryColonizeBudgetCards(): ReactElement {
  const [actions, setActions] = useState(stationaryColonizePlayerView.actions)
  const currentPlayerView = { ...stationaryColonizePlayerView, actions }
  const projection = requireEligibilityProjection(currentPlayerView)

  const submissions = projection.eligibilityState.actions.filter((action): action is SubmittedAction => action.selectedTargets !== null)
  const evaluation = evaluateSubmittedActions({
    state: projection.eligibilityState,
    ruleset: projection.ruleset,
    submissions,
  })
  const budget = {
    status: evaluation.status,
    strengthCommitment: evaluation.strengthCommitments[stationaryColonizeFleet.id] ?? 0,
    remainingStrength: evaluation.remainingStrength[stationaryColonizeFleet.id],
    influenceCommitted: evaluation.resourceCommitments[ResourceType.INFLUENCE],
    fuelCommitted: evaluation.resourceCommitments[ResourceType.FUEL],
    influenceAvailable: currentPlayerView.resources[ResourceType.INFLUENCE].total - evaluation.resourceCommitments[ResourceType.INFLUENCE],
    fuelAvailable: currentPlayerView.resources[ResourceType.FUEL].total - evaluation.resourceCommitments[ResourceType.FUEL],
  }

  return (
    <div className="flex flex-wrap gap-4">
      <output data-testid="stationary-colonize-budget" className="sr-only">
        {JSON.stringify(budget)}
      </output>
      <ActionCard
        actionDefinition={MoveFleetStandard}
        action={actions[0]}
        playerView={currentPlayerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setActions((currentActions) =>
            currentActions.map((action) =>
              action.id === stationaryColonizeMoveAction.id ? { ...action, selectedTargets, selectedInputs } : action,
            ),
          )
        }}
      />
      <ActionCard
        actionDefinition={ColonizeHereTest}
        action={actions[1]}
        playerView={currentPlayerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setActions((currentActions) =>
            currentActions.map((action) =>
              action.id === stationaryColonizeAction.id ? { ...action, selectedTargets, selectedInputs } : action,
            ),
          )
        }}
      />
    </div>
  )
}

export const seedOutpostSource = createPlanetStub({
  id: "planet-seed-outpost-home",
  ownerPlayerId: player.id,
  name: "Outpost Home",
  coordinates: "0:0:0",
  x: 0,
  y: 0,
})

export const seedOutpostSite = createPlanetStub({
  id: "planet-seed-site",
  ownerPlayerId: null,
  name: "Seed Site",
  coordinates: "3:0:0",
  x: 3,
  y: 0,
})

export const seedOutpostNearbySite = createPlanetStub({
  id: "planet-seed-nearby-site",
  ownerPlayerId: null,
  name: "Nearby Seed Site",
  coordinates: "2:0:0",
  x: 2,
  y: 0,
})

export const seedOutpostBeyondRange = createPlanetStub({
  id: "planet-seed-beyond-range",
  ownerPlayerId: null,
  name: "Beyond Seed Range",
  coordinates: "3.001:0:0",
  x: 3.001,
  y: 0,
})

export const seedOutpostFleet = createFleetStub({
  id: "fleet-seed-outpost",
  ownerPlayerId: player.id,
  name: "Outpost Guard",
  strength: 45,
  originPlanetId: seedOutpostSource.id,
})

export const SeedOutpostDefinition = typedParse(ActionDefinitionSchema, {
  ...ColonizePlanetTest,
  id: "RENAMED_SEED_OUTPOST",
  name: "Seed Outpost",
  tier: ActionTier.IMPROVED,
  inputs: { quota: { type: "POSITIVE_INTEGER", label: "Units" } },
  targets: {
    force: {
      targetType: TargetType.FLEET,
      constraints: [OwnedBySubmittingPlayerConstraint.create(), StationaryFleetConstraint.create()],
    },
    site: {
      targetType: TargetType.PLANET,
      constraints: [
        WithinFleetRangeConstraint.create({ sourceFleetTag: "force", maxDistance: 3 }),
        DifferentFromFleetOriginConstraint.create({ sourceFleetTag: "force" }),
        UnclaimedPlanetConstraint.create(),
      ],
    },
  },
  costs: [
    ResourceLossEffectDefinition.create({ quantity: 7, resourceType: ResourceType.INFLUENCE }),
    ResourceLossEffectDefinition.create({ quantity: 2, resourceType: ResourceType.FUEL }),
  ],
  effects: [
    FleetMoveEffectDefinition.create({ fleetTag: "force", planetTag: "site", strengthTag: "quota", speed: 2 }),
    FleetColonizeEffectDefinition.create({ fleetTag: "force", planetTag: "site", strengthRequirement: 30 }),
  ],
})

export const seedOutpostAction = createAvailableActionStub({
  id: "SEED_OUTPOST_STORY",
  playerId: player.id,
  actionDefinitionId: SeedOutpostDefinition.id,
})

export const seedOutpostRuleset = Ruleset.create({
  ...TestRuleset,
  actionDefinitions: { ...TestRuleset.actionDefinitions, [SeedOutpostDefinition.id]: SeedOutpostDefinition },
  actionPool: [...TestRuleset.actionPool, { id: seedOutpostAction.id, actionDefinitionId: SeedOutpostDefinition.id }],
})

export const seedOutpostPlayerView = {
  ...playerView,
  galaxy: {
    systems: [
      {
        star: createStarStub({ id: "seed-outpost-star", name: "Outpost System", coordinates: "0:0", x: 0, y: 0 }),
        planets: [seedOutpostSource, seedOutpostSite, seedOutpostNearbySite, seedOutpostBeyondRange],
      },
    ],
  },
  fleets: [seedOutpostFleet],
  resources: {
    ...playerView.resources,
    [ResourceType.INFLUENCE]: { total: 7, uncommitted: 7 },
    [ResourceType.FUEL]: { total: 2, uncommitted: 2 },
  },
  ruleset: seedOutpostRuleset,
  actions: [toActionDto(seedOutpostAction, false)],
} satisfies PlayerView

export const seedOutpostProjection = requireEligibilityProjection(seedOutpostPlayerView)

export function SeedOutpostCard(): ReactElement {
  const [action, setAction] = useState(toActionDto(seedOutpostAction, false))
  const currentPlayerView = { ...seedOutpostPlayerView, actions: [action] }
  const projection = requireEligibilityProjection(currentPlayerView)

  return (
    <div className="w-80">
      <output data-testid="seed-outpost-selection" className="sr-only">
        {JSON.stringify({ selectedTargets: action.selectedTargets, selectedInputs: action.selectedInputs })}
      </output>
      <ActionCard
        actionDefinition={SeedOutpostDefinition}
        action={action}
        playerView={currentPlayerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setAction({ ...action, selectedTargets, selectedInputs })
        }}
      />
    </div>
  )
}
