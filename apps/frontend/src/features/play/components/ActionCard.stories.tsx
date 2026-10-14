import type { PlayerView } from "@api-types"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { createAvailableActionStub, createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "shared/domain/world/fleets/Fleet.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { FleetActionSelectionParity } from "shared/testing/FleetActionSelectionParity.ts"
import { MoveFleetExceptional, MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { TestRuleset } from "shared/testing/test-ruleset/TestRuleset.ts"
import { expect, within } from "storybook/test"
import {
  arbitraryTagActionDefinition,
  arbitraryTagAction,
  arbitraryTagPlayerView,
  arbitraryTagProjection,
  exceptionalAction,
  exceptionalPlayerView,
  exceptionalProjection,
} from "./ActionCard.movement-fixture.tsx"
import {
  requireEligibilityProjection,
  toActionDto,
  player,
  home,
  waypoint,
  farReach,
  homeFleet,
  northernFleet,
  currentAction,
  existingAllocation,
  storyRuleset,
  playerView,
  frontendProjection,
  actionForCard,
  players,
  parityStandardAction,
  parityPlayerView,
  parityNormalizedInput,
  parityProjection,
  composedMoveAction,
  composedReservationPlayerView,
  ComposedReservationCards,
} from "./ActionCard.selection-fixture.tsx"
import { ActionCard } from "./ActionCard.tsx"

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
    await expect(parityNormalizedInput).toEqual(FleetActionSelectionParity.normalizedInput)
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
    const projection = requireEligibilityProjection(candidateView)

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
    const projection = requireEligibilityProjection(candidateView)

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
    const movement = typedParse(FleetMovementSchema, {
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
    const occupiedProjection = requireEligibilityProjection(occupiedView)

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
