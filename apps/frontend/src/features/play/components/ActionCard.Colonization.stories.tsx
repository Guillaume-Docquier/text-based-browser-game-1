import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { ColonizeHereTest, ColonizePlanetTest } from "shared/testing/test-ruleset/action-definitions/colonize.ts"
import { MoveFleetStandard } from "shared/testing/test-ruleset/action-definitions/move-fleet.ts"
import { expect, within } from "storybook/test"
import {
  colonizeThresholdFleet,
  colonizeThresholdAction,
  colonizeThresholdPlayerView,
  colonizeThresholdProjection,
  ColonizeThresholdCard,
  stationaryColonizeAction,
  stationaryColonizePlayerView,
  stationaryColonizeProjection,
  StationaryColonizeBudgetCards,
  seedOutpostSite,
  seedOutpostFleet,
  SeedOutpostDefinition,
  seedOutpostAction,
  seedOutpostPlayerView,
  seedOutpostProjection,
  SeedOutpostCard,
} from "./ActionCard.colonization-fixture.tsx"
import { toActionDto, waypoint, playerView, frontendProjection, actionForCard, players } from "./ActionCard.selection-fixture.tsx"
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

export const ColonizePlanetThreshold: Story = {
  render: (): ReactElement => <ColonizeThresholdCard />,
  args: {
    actionDefinition: ColonizePlanetTest,
    action: toActionDto(colonizeThresholdAction, false),
    playerView: colonizeThresholdPlayerView,
    players,
    ruleset: colonizeThresholdProjection.ruleset,
    eligibilityState: colonizeThresholdProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, userEvent }): Promise<void> => {
    const card = within(canvas.getByRole("group", { name: "Colonize Planet action" }))
    await expect(card.getByText("Exceptional Directive")).toBeVisible()
    await expect(card.getByLabelText("25 Influence")).toBeVisible()
    await expect(card.getByRole("combobox", { name: "Fleet target" })).toHaveValue("Threshold Guard (100 strength)")
    await expect(card.getByRole("combobox", { name: "Planet target" })).toHaveValue("Waypoint (2:0:0)")
    const strengthInput = card.getByRole("spinbutton", { name: "Fleet strength" })
    const selectionButton = card.getByRole("button", { name: "Select action" })

    await userEvent.type(strengthInput, "19")
    await expect(selectionButton).toBeDisabled()
    await userEvent.clear(strengthInput)
    await userEvent.type(strengthInput, "20")
    await expect(selectionButton).toBeEnabled()
    await userEvent.click(selectionButton)
    const exactThresholdSelection = canvas.getByTestId("colonize-threshold-selection").textContent
    await expect(JSON.parse(exactThresholdSelection ?? "null")).toStrictEqual({
      selectedTargets: { fleet: colonizeThresholdFleet.id, planet: waypoint.id },
      selectedInputs: { strength: 20 },
    })

    await userEvent.clear(strengthInput)
    await userEvent.type(strengthInput, "35")
    const updateButton = card.getByRole("button", { name: "Update action" })
    await expect(updateButton).toBeEnabled()
    await userEvent.click(updateButton)
    const aboveThresholdSelection = canvas.getByTestId("colonize-threshold-selection").textContent
    await expect(JSON.parse(aboveThresholdSelection ?? "null")).toStrictEqual({
      selectedTargets: { fleet: colonizeThresholdFleet.id, planet: waypoint.id },
      selectedInputs: { strength: 35 },
    })
  },
}

export const StationaryColonizeBudget: Story = {
  render: (): ReactElement => <StationaryColonizeBudgetCards />,
  args: {
    actionDefinition: ColonizeHereTest,
    action: toActionDto(stationaryColonizeAction, false),
    playerView: stationaryColonizePlayerView,
    players,
    ruleset: stationaryColonizeProjection.ruleset,
    eligibilityState: stationaryColonizeProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const moveCard = within(canvas.getByRole("group", { name: "Move Fleet action" }))
    const colonizeCard = within(canvas.getByRole("group", { name: "Colonize Here action" }))
    const movePlanetPicker = moveCard.getByRole("combobox", { name: "Planet target" })
    await userEvent.click(movePlanetPicker)
    await userEvent.click(body.getByRole("option", { name: "Inner Reach (4:0:0)" }))
    await userEvent.type(moveCard.getByRole("spinbutton", { name: "Fleet strength" }), "15")
    await userEvent.click(moveCard.getByRole("button", { name: "Select action" }))
    await expect(moveCard.getByText("20 of 35 strength available after this allocation")).toBeVisible()
    await expect(
      colonizeCard.getByText("Claim the unclaimed planet at the selected fleet's current location; success consumes 20 fleet strength."),
    ).toBeVisible()
    await expect(colonizeCard.getByLabelText("25 Influence")).toBeVisible()
    await expect(colonizeCard.getByRole("combobox", { name: "Fleet target" })).toHaveValue("Wayfinder Guard (35 strength)")
    await expect(colonizeCard.getByRole("combobox", { name: "Planet target" })).toHaveValue("Waypoint (2:0:0)")
    await userEvent.click(colonizeCard.getByRole("button", { name: "Select action" }))
    await expect(colonizeCard.getByText("0 of 35 strength available after this allocation")).toBeVisible()
    const initialBudget = canvas.getByTestId("stationary-colonize-budget").textContent
    await expect(JSON.parse(initialBudget ?? "null")).toStrictEqual({
      status: "ELIGIBLE",
      strengthCommitment: 35,
      remainingStrength: 0,
      influenceCommitted: 28,
      fuelCommitted: 1,
      influenceAvailable: 72,
      fuelAvailable: 9,
    })

    await userEvent.click(moveCard.getByRole("button", { name: "Update action" }))
    const moveStrengthInput = moveCard.getByRole("spinbutton", { name: "Fleet strength" })
    await userEvent.clear(moveStrengthInput)
    await userEvent.type(moveStrengthInput, "14")
    await userEvent.click(moveCard.getByRole("button", { name: "Update action" }))
    await expect(colonizeCard.getByText("1 of 35 strength available after this allocation")).toBeVisible()

    await userEvent.click(moveCard.getByRole("button", { name: "Cancel" }))
    await expect(colonizeCard.getByText("15 of 35 strength available after this allocation")).toBeVisible()
    const canceledMoveBudget = canvas.getByTestId("stationary-colonize-budget").textContent
    await expect(JSON.parse(canceledMoveBudget ?? "null")).toStrictEqual({
      status: "ELIGIBLE",
      strengthCommitment: 20,
      remainingStrength: 15,
      influenceCommitted: 25,
      fuelCommitted: 0,
      influenceAvailable: 75,
      fuelAvailable: 10,
    })
  },
}

export const RenamedSeedOutpost: Story = {
  render: (): ReactElement => <SeedOutpostCard />,
  args: {
    actionDefinition: SeedOutpostDefinition,
    action: toActionDto(seedOutpostAction, false),
    playerView: seedOutpostPlayerView,
    players,
    ruleset: seedOutpostProjection.ruleset,
    eligibilityState: seedOutpostProjection.eligibilityState,
    disabled: false,
  },
  play: async ({ canvas, canvasElement, userEvent }): Promise<void> => {
    const body = within(canvasElement.ownerDocument.body)
    const card = within(canvas.getByRole("group", { name: "Seed Outpost action" }))
    await expect(card.getByText("Improved Directive")).toBeVisible()
    await expect(
      card.getByText(
        "Move a fleet to the target planet at 2 light years per turn, within a range of 3 light years. On arrival, claim the unclaimed target planet; success consumes 30 fleet strength.",
      ),
    ).toBeVisible()
    await expect(card.getByLabelText("7 Influence")).toBeVisible()
    await expect(card.getByLabelText("2 Fuel")).toBeVisible()
    const forcePicker = card.getByRole("combobox", { name: "Force target" })
    const sitePicker = card.getByRole("combobox", { name: "Site target" })
    const unitsInput = card.getByRole("spinbutton", { name: "Units" })
    await expect(forcePicker).toHaveValue("Outpost Guard (45 strength)")

    await userEvent.type(unitsInput, "30")
    await userEvent.click(sitePicker)
    await expect(body.getByRole("option", { name: "Seed Site (3:0:0)" })).toBeVisible()
    await expect(body.getByRole("option", { name: "Nearby Seed Site (2:0:0)" })).toBeVisible()
    await expect(body.queryByRole("option", { name: "Beyond Seed Range (3.001:0:0)" })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: "Seed Site (3:0:0)" }))
    await userEvent.clear(unitsInput)
    await userEvent.type(unitsInput, "29")
    await expect(card.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.clear(unitsInput)
    await userEvent.type(unitsInput, "30")
    await expect(card.getByRole("button", { name: "Select action" })).toBeEnabled()
    await userEvent.click(card.getByRole("button", { name: "Select action" }))
    const selection = canvas.getByTestId("seed-outpost-selection").textContent
    await expect(JSON.parse(selection ?? "null")).toStrictEqual({
      selectedTargets: { force: seedOutpostFleet.id, site: seedOutpostSite.id },
      selectedInputs: { quota: 30 },
    })

    await userEvent.clear(unitsInput)
    await userEvent.type(unitsInput, "45")
    const updateButton = card.getByRole("button", { name: "Update action" })
    await expect(updateButton).toBeEnabled()
    await userEvent.click(updateButton)
    const aboveThresholdSelection = canvas.getByTestId("seed-outpost-selection").textContent
    await expect(JSON.parse(aboveThresholdSelection ?? "null")).toStrictEqual({
      selectedTargets: { force: seedOutpostFleet.id, site: seedOutpostSite.id },
      selectedInputs: { quota: 45 },
    })
  },
}
