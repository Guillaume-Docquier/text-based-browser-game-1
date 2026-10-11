import type { Action, PlayerView, Players } from "@api-types"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { GameIdSchema } from "shared/domain/games/GameId.ts"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
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
    const destinationPicker = canvas.getByRole("combobox", { name: "Landingsite target" })
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

function toActionDto(action: Omit<Action, "canAfford" | "isInProgress">, isInProgress: boolean): Action {
  return { ...action, canAfford: true, isInProgress }
}
