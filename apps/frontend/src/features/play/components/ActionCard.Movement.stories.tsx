import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ReactElement, useState } from "react"
import { evaluateSubmittedActions } from "shared/action-submission/evaluateActionSelection.ts"
import { FleetAssaultEffectDefinition } from "shared/domain/ruleset/effect-definitions/FleetAssaultEffectDefinition.ts"
import { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { FleetMovementSchema } from "shared/domain/world/fleets/Fleet.ts"
import { AttackMoveTest } from "shared/testing/test-ruleset/action-definitions/attack-move.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect, within } from "storybook/test"
import {
  forwardConjoinedRangeFixture,
  reversedConjoinedRangeFixture,
  ConjoinedRangeCard,
  renamedRelayDefinition,
  renamedRelayBusyAction,
  renamedRelayDraftAction,
  renamedRelayUnaffordableAction,
  renamedRelayPlayerView,
  renamedRelayProjection,
  renamedRelayInProgressPlayerView,
  renamedRelayInProgressProjection,
  renamedRelayUnaffordablePlayerView,
  renamedRelayUnaffordableProjection,
} from "./ActionCard.movement-fixture.tsx"
import {
  requireEligibilityProjection,
  toActionDto,
  player,
  waypoint,
  homeFleet,
  playerView,
  frontendProjection,
  actionForCard,
  players,
  attackMoveAction,
  attackMovePlayerView,
  attackMoveProjection,
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
    const projection = requireEligibilityProjection(args.playerView)

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
          movement: typedParse(FleetMovementSchema, {
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
    const projection = requireEligibilityProjection(args.playerView)

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
