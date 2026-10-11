import type { Action, PlayerView, ResourceType, ResourceStockpile } from "@api-types"
import { typedParse, PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, type ReactElement } from "react"
import { computeActionCommitments, evaluateActionSelection } from "shared/action-submission/actionEligibility.ts"
import { ActionDefinitionSchema } from "shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import { RulesetSchema } from "shared/domain/ruleset/Ruleset.ts"
import { createSubmittedActionStub } from "shared/domain/turns/actions/Action.stub.ts"
import { createFleetStub } from "shared/domain/world/fleets/Fleet.stub.ts"
import { PendingArrivalEffectSchema } from "shared/domain/world/fleets/PendingArrivalEffect.ts"
import { createPlanetStub } from "shared/domain/world/planets/Planet.stub.ts"
import { createSeededRng } from "shared/testing/createSeededRng.ts"
import { resolveTurn } from "shared/turn-resolution/resolveTurn.ts"
import { expect, within } from "storybook/test"
import { toActionEligibilityState } from "../actionEligibilityState.ts"
import {
  createColonizeOwnershipScenario,
  createColonizeActionCardScenario,
  createAttackActionCardScenario,
  createFleetActionCardScenario,
} from "./ActionCard.stub.ts"
import { ActionCard } from "./ActionCard.tsx"
import { createFleetOperationsCardCheckpoint } from "./FleetOperationsCardCheckpoint.stub.ts"

function projectStorySubmissions(view: PlayerView, actions: Action[]): PlayerView {
  const next = { ...view, actions }
  const commitments = computeActionCommitments({ ruleset: view.ruleset, actions: toActionEligibilityState(next).submittedActions })
  const stockpile = (type: ResourceType): ResourceStockpile => ({
    total: view.resources[type].total,
    uncommitted: view.resources[type].total - (commitments.resources[view.player.id]?.[type] ?? 0),
  })
  return {
    ...next,
    resources: {
      INFLUENCE: stockpile("INFLUENCE"),
      FUEL: stockpile("FUEL"),
      METAL: stockpile("METAL"),
      ENERGY: stockpile("ENERGY"),
      COLONY: stockpile("COLONY"),
    },
  }
}

function FleetActionExample({
  initialView,
  actionId,
  showSiblingCancellation = false,
}: {
  initialView: PlayerView
  actionId: string
  showSiblingCancellation?: boolean
}): ReactElement {
  const [view, setView] = useState(initialView)
  const { players } = createFleetActionCardScenario()
  const action = view.actions.find((action) => action.id === actionId)
  if (action === undefined) return <p>Missing story action</p>
  return (
    <>
      <ActionCard
        action={action}
        actionDefinition={view.ruleset.actionDefinitions[action.actionDefinitionId]}
        playerView={view}
        players={players}
        resources={view.resources}
        canAfford={action.canAffordResources}
        isSelected={action.status === "SUBMITTED"}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          const actions = view.actions.map((candidate) =>
            candidate.id !== action.id
              ? candidate
              : {
                  ...candidate,
                  selectedTargets,
                  selectedInputs,
                  status: selectedTargets === null ? ("AVAILABLE" as const) : ("SUBMITTED" as const),
                },
          )
          setView(projectStorySubmissions(view, actions))
        }}
      />
      {showSiblingCancellation ? (
        <button
          type="button"
          onClick={() => {
            setView(
              projectStorySubmissions(
                view,
                view.actions.map((candidate) =>
                  candidate.id === "X" ? { ...candidate, status: "AVAILABLE", selectedTargets: null, selectedInputs: null } : candidate,
                ),
              ),
            )
          }}
        >
          Cancel sibling order
        </button>
      ) : null}
      <output aria-label="Uncommitted fleet strength">
        {view.fleets
          .map(
            (fleet) =>
              `${fleet.name}:${fleet.strength - (computeActionCommitments({ ruleset: view.ruleset, actions: toActionEligibilityState(view).submittedActions }).strength[fleet.id] ?? 0)}`,
          )
          .join(",")}
      </output>
      <output aria-label="Saved orders">
        {JSON.stringify(
          view.actions
            .filter((action) => action.status === "SUBMITTED")
            .map((action) => ({ id: action.id, inputs: action.selectedInputs })),
        )}
      </output>
    </>
  )
}
const initial = createFleetActionCardScenario()
const meta = {
  title: "Application/Action Card",
  component: ActionCard,
  args: {
    action: initial.view.actions[1],
    actionDefinition: initial.definition,
    playerView: initial.view,
    players: initial.players,
    resources: initial.view.resources,
    canAfford: true,
    isSelected: false,
    disabled: false,
    onSelect: (): void => {},
  },
  render: (): ReactElement => <FleetActionExample initialView={initial.view} actionId="Y" />,
} satisfies Meta<typeof ActionCard>
export default meta
type Story = StoryObj<typeof meta>
/** A sibling commitment leaves exactly 30. An invalid edit stays local. */
export const CumulativeStrength: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole("spinbutton", { name: "Force" })
    await expect(canvas.getByText("Force (available 30)")).toBeVisible()
    await userEvent.type(canvas.getByRole("combobox", { name: "Route target" }), "Boundary")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await userEvent.type(input, "31")
    await expect(canvas.getByText("Insufficient fleet strength: shortfall 1")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":20}}]')
    await userEvent.clear(input)
    await userEvent.type(input, "30")
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent(
      '[{"id":"X","inputs":{"force":20}},{"id":"Y","inputs":{"force":30}}]',
    )
  },
}
/** Editing excludes its own allocation; cancellation still works during an invalid draft. */
export const ReplacementAndCancellation: Story = {
  render: () => <FleetActionExample initialView={initial.view} actionId="X" />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("spinbutton", { name: "Force" })
    await expect(canvas.getByText("Force (available 50)")).toBeVisible()
    await userEvent.clear(input)
    await userEvent.type(input, "51")
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":20}}]')
    await userEvent.click(canvas.getByRole("button", { name: "Selected" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent("[]")
    await expect(input).toHaveValue(null)
    await expect(canvas.getByRole("combobox", { name: "Route target" })).toHaveValue("")
    await expect(canvas.getByText("Force (available 50)")).toBeVisible()
  },
}
export const InProgress: Story = {
  render: () => {
    const action = initial.scenario.order("X", 20)
    const view: PlayerView = {
      ...initial.view,
      fleets: [
        { ...initial.scenario.source, strength: 30 },
        createFleetStub({
          ...initial.scenario.source,
          id: "journey",
          name: "Journey",
          strength: 20,
          destinationPlanetId: initial.scenario.destination.id,
          distanceToEnd: 3,
          movement: { type: "FLEET_MOVE", initiatingTurn: 1, submittedAction: action, speed: typedParse(PositiveNumberSchema, 2) },
        }),
      ],
      actions: initial.view.actions.map((candidate): Action =>
        candidate.id !== action.id
          ? candidate
          : {
              ...candidate,
              status: "IN_PROGRESS",
              inProgressFleetId: createFleetStub({ id: "journey" }).id,
              destinationPlanetId: initial.scenario.destination.id,
            },
      ),
    }
    return <FleetActionExample initialView={view} actionId="X" />
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("In progress: Journey to Boundary")).toBeVisible()
    await expect(canvas.getByRole("spinbutton", { name: "Force" })).toBeDisabled()
    await expect(canvas.queryByRole("button", { name: "Selected" })).not.toBeInTheDocument()
  },
}

/** Changing source clears a stale destination while retaining the local numeric draft. */
export const SourceDependentDestination: Story = {
  render: () => {
    const origin = createPlanetStub({ id: "other-origin", name: "Other origin", x: 10, y: 0 })
    const destination = createPlanetStub({ id: "other-destination", name: "New route", x: 10, y: 3 })
    const source = createFleetStub({
      ...initial.scenario.source,
      id: "second-source",
      name: "Second source",
      originPlanetId: origin.id,
      strength: 10,
    })
    const view = {
      ...initial.view,
      fleets: [...initial.view.fleets, source],
      galaxy: { systems: initial.view.galaxy.systems.map((system) => ({ ...system, planets: [...system.planets, origin, destination] })) },
    }
    return <FleetActionExample initialView={view} actionId="X" />
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const source = canvas.getByRole("combobox", { name: "Craft target" })
    await userEvent.clear(source)
    await userEvent.type(source, "second")
    await userEvent.click(body.getByRole("option", { name: /second-s/ }))
    await expect(canvas.getByRole("combobox", { name: "Route target" })).toHaveValue("")
    await expect(canvas.getByRole("spinbutton", { name: "Force" })).toHaveValue(20)
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":20}}]')
    await userEvent.type(canvas.getByRole("combobox", { name: "Route target" }), "New route")
    await userEvent.click(body.getByRole("option", { name: /New route/ }))
    await userEvent.clear(canvas.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Force" }), "10")
    await userEvent.click(canvas.getByRole("button", { name: "Update action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":10}}]')
  },
}

/** A fresh sibling cancellation updates the actual projection without resetting an unrelated local draft. */
export const SiblingCancellationRefreshesDraft: Story = {
  render: () => <FleetActionExample initialView={initial.view} actionId="Y" showSiblingCancellation />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole("spinbutton", { name: "Force" })
    await userEvent.type(canvas.getByRole("combobox", { name: "Route target" }), "Boundary")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.type(input, "31")
    await expect(canvas.getByText("Insufficient fleet strength: shortfall 1")).toBeVisible()
    await userEvent.click(canvas.getByRole("button", { name: "Cancel sibling order" }))
    await expect(canvas.getByText("Force (available 50)")).toBeVisible()
    await expect(input).toHaveValue(31)
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{"force":31}}]')
  },
}

/** The view's cached eligibility flag cannot override a newer strength snapshot. */
export const FreshStrengthInvalidatesSavedOrder: Story = {
  render: () => (
    <FleetActionExample initialView={{ ...initial.view, fleets: [{ ...initial.scenario.source, strength: 19 }] }} actionId="X" />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Insufficient fleet strength: shortfall 1")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":20}}]')
  },
}

/** Projection retains total stockpiles and reservations; resolver checks the same completed set before payment. */
export const ProjectedResolverParity: Story = {
  play: async ({ canvas }) => {
    const fixture = initial.scenario
    const state = toActionEligibilityState(initial.view)
    await expect(state.players[fixture.playerId]?.resources).toMatchObject({ INFLUENCE: 6, FUEL: 2 })
    await expect(state.submittedActions).toStrictEqual([fixture.order("X", 20)])
    for (const strength of [30, 31]) {
      const candidate = fixture.order("Y", strength)
      const evaluation = evaluateActionSelection({
        state,
        ruleset: fixture.ruleset,
        action: candidate,
        selection: candidate,
        mode: "complete",
      })
      const resolved = resolveTurn(
        structuredClone({ ...state, winnerPlayerId: undefined, submittedActions: [...state.submittedActions, candidate] }),
        fixture.ruleset,
        createSeededRng(),
      )
      await expect(evaluation.eligible).toBe(strength === 30)
      await expect(resolved.type).toBe(strength === 30 ? "Success" : "Failure")
      if (strength === 31)
        await expect(evaluation.issues).toContainEqual(expect.objectContaining({ path: ["selectedInputs", "force"], shortfall: 1 }))
    }
    const outside = createPlanetStub({ id: "outside", x: 3, y: 4.000001 })
    const invalidSelections = [
      { targets: { craft: "source", route: "destination" }, inputs: { force: 0 }, path: ["selectedInputs", "force"] },
      { targets: { craft: "missing", route: "destination" }, inputs: { force: 1 }, path: ["selectedTargets", "craft"] },
      { targets: { craft: "source", route: "origin" }, inputs: { force: 1 }, path: ["selectedTargets", "route"] },
      { targets: { craft: "source", route: "outside" }, inputs: { force: 1 }, path: ["selectedTargets", "route"] },
    ]
    const scoped = { ...state, planets: { ...state.planets, [outside.id]: outside } }
    for (const invalid of invalidSelections) {
      const candidate = structuredClone(fixture.order("Y", 1))
      Reflect.set(candidate, "selectedTargets", invalid.targets)
      Reflect.set(candidate, "selectedInputs", invalid.inputs)
      const evaluation = evaluateActionSelection({
        state: scoped,
        ruleset: fixture.ruleset,
        action: candidate,
        selection: candidate,
        mode: "complete",
      })
      const resolved = resolveTurn(
        structuredClone({ ...scoped, winnerPlayerId: undefined, submittedActions: [...state.submittedActions, candidate] }),
        fixture.ruleset,
        createSeededRng(),
      )
      await expect(evaluation.eligible).toBe(false)
      await expect(evaluation.issues).toContainEqual(expect.objectContaining({ path: invalid.path, status: "invalid" }))
      await expect(resolved).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
    }
    await expect(canvas.getByText("Force (available 30)")).toBeVisible()
  },
}

/** Assault content uses the same source budget as the sibling ordinary Move. */
export const AttackAllocation: Story = {
  render: () => <FleetActionExample initialView={createAttackActionCardScenario().view} actionId="ATTACK_MOVE_STANDARD_1" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    // Exercise the actual view projection and resolver with Test's literal 25-light-year boundary.
    const fixture = createAttackActionCardScenario()
    const projected = toActionEligibilityState(fixture.view)
    const ruleset = typedParse(RulesetSchema, fixture.view.ruleset)
    const boundary = createPlanetStub({ id: "attack-boundary", x: 15, y: 20 })
    const outside = createPlanetStub({ id: "attack-outside", x: 15, y: 20.000001 })
    const state = { ...projected, planets: { ...projected.planets, [boundary.id]: boundary, [outside.id]: outside } }
    for (const [destination, strength, eligible] of [
      [boundary, 30, true],
      [boundary, 31, false],
      [outside, 30, false],
    ] as const) {
      const candidate = createSubmittedActionStub({
        id: "ATTACK_MOVE_STANDARD_1",
        playerId: fixture.view.player.id,
        actionDefinitionId: fixture.definition.id,
        selectedTargets: { fleet: fixture.scenario.source.id, planet: destination.id },
        selectedInputs: { strength },
      })
      const evaluation = evaluateActionSelection({
        state,
        ruleset: fixture.view.ruleset,
        action: candidate,
        selection: candidate,
        mode: "complete",
      })
      const resolved = resolveTurn(
        structuredClone({ ...state, winnerPlayerId: undefined, submittedActions: [...state.submittedActions, candidate] }),
        ruleset,
        createSeededRng(),
      )
      await expect(evaluation.eligible).toBe(eligible)
      await expect(resolved).toMatchObject(
        eligible
          ? { type: "Success", value: { turn: 1, fleets: expect.any(Object) } }
          : { type: "Failure", error: { type: "INVALID_SUBMISSIONS" } },
      )
      if (strength === 31) await expect(evaluation.issues).toContainEqual(expect.objectContaining({ shortfall: 1 }))
      if (destination === outside)
        await expect(evaluation.issues).toContainEqual(expect.objectContaining({ path: ["selectedTargets", "planet"] }))
    }
    await expect(canvas.getByText(/assault all enemy fleets/)).toBeVisible()
    await expect(canvas.getByText(/10 light years per turn/)).toBeVisible()
    await expect(canvas.getByText("Strength (available 30)")).toBeVisible()
    await userEvent.type(canvas.getByRole("combobox", { name: "Planet target" }), "Boundary")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Strength" }), "31")
    await expect(canvas.getByText("Insufficient fleet strength: shortfall 1")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.clear(canvas.getByRole("spinbutton", { name: "Strength" }))
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Strength" }), "30")
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent(
      '[{"id":"X","inputs":{"force":20}},{"id":"ATTACK_MOVE_STANDARD_1","inputs":{"strength":30}}]',
    )
    // Replacing excludes this Attack's old strength; cancellation leaves the sibling Move intact.
    await userEvent.clear(canvas.getByRole("spinbutton", { name: "Strength" }))
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Strength" }), "25")
    await userEvent.click(canvas.getByRole("button", { name: "Update action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent(
      '[{"id":"X","inputs":{"force":20}},{"id":"ATTACK_MOVE_STANDARD_1","inputs":{"strength":25}}]',
    )
    await userEvent.click(canvas.getByRole("button", { name: "Selected" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"X","inputs":{"force":20}}]')
    await expect(canvas.getByText("Strength (available 30)")).toBeVisible()
  },
}

/** Destination-first content must support choosing a planet before entering strength. */
export const DestinationFirstAttack: Story = {
  render: () => {
    const fixture = createAttackActionCardScenario()
    const definition = typedParse(ActionDefinitionSchema, {
      ...fixture.definition,
      targets: Object.fromEntries(Object.entries(fixture.definition.targets).toReversed()),
    })
    const view: PlayerView = {
      ...fixture.view,
      ruleset: {
        ...fixture.view.ruleset,
        actionDefinitions: { ...fixture.view.ruleset.actionDefinitions, [definition.id]: definition },
      },
    }
    return <FleetActionExample initialView={view} actionId="ATTACK_MOVE_STANDARD_1" />
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole("combobox", { name: "Fleet target" })).toHaveValue("Fleet source (50 strength)")
    await expect(canvas.getByRole("combobox", { name: "Planet target" })).toBeEnabled()
    await userEvent.click(canvas.getByRole("combobox", { name: "Planet target" }))
    const options = within(canvasElement.ownerDocument.body)
    await expect(options.getAllByRole("option")).toHaveLength(2)
    await expect(options.getByRole("option", { name: /Boundary/ })).toBeVisible()
    await expect(options.getByRole("option", { name: /Other/ })).toBeVisible()
    await userEvent.click(options.getByRole("option", { name: /Boundary/ }))
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Strength" }), "30")
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent(
      '[{"id":"X","inputs":{"force":20}},{"id":"ATTACK_MOVE_STANDARD_1","inputs":{"strength":30}}]',
    )
    await expect(canvas.getByRole("combobox", { name: "Planet target" })).toHaveValue("Boundary (0:0:0)")
  },
}

/** A paid Attack remains bound to its journey while the second Test instance can use the remainder. */
export const AttackInProgress: Story = {
  render: () => {
    const fixture = createAttackActionCardScenario()
    const first = fixture.view.actions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")
    if (first === undefined) return <p>Missing Attack fixture</p>
    const order = createSubmittedActionStub({
      id: first.id,
      actionDefinitionId: first.actionDefinitionId,
      playerId: fixture.view.player.id,
      selectedTargets: { fleet: fixture.scenario.source.id, planet: fixture.scenario.destination.id },
      selectedInputs: { strength: 30 },
    })
    const pending = fixture.definition.effects.flatMap((definition, index) =>
      definition.type === "ASSAULT" ? [typedParse(PendingArrivalEffectSchema, { type: "ASSAULT", effectIndex: index, definition })] : [],
    )
    const journey = createFleetStub({
      ...fixture.scenario.source,
      id: "attack-journey",
      name: "Attack journey",
      strength: 30,
      destinationPlanetId: fixture.scenario.destination.id,
      distanceToEnd: 15,
      movement: {
        type: "FLEET_MOVE",
        speed: typedParse(PositiveNumberSchema, 10),
        initiatingTurn: 1,
        submittedAction: order,
        pendingArrivalEffects: pending,
      },
    })
    const view: PlayerView = {
      ...fixture.view,
      fleets: [{ ...fixture.scenario.source, strength: 20 }, journey],
      actions: fixture.view.actions.map((action): Action =>
        action.id === first.id
          ? {
              ...action,
              selectedTargets: order.selectedTargets,
              selectedInputs: order.selectedInputs,
              status: "IN_PROGRESS",
              inProgressFleetId: journey.id,
              destinationPlanetId: fixture.scenario.destination.id,
            }
          : { ...action, selectedTargets: null, selectedInputs: null, status: "AVAILABLE" },
      ),
    }
    return (
      <div className="flex flex-wrap gap-8">
        <FleetActionExample initialView={view} actionId={first.id} />
        <FleetActionExample initialView={view} actionId="ATTACK_MOVE_STANDARD_2" />
      </div>
    )
  },
}

/** Configured minimum gates the real draft before a saved order is replaced. */
export const ColonizeThreshold: Story = {
  render: () => <FleetActionExample initialView={createColonizeActionCardScenario().view} actionId="Y" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await expect(within(canvasElement.ownerDocument.body).queryByRole("option", { name: /Origin/ })).not.toBeInTheDocument()
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    const input = canvas.getByRole("spinbutton", { name: "Force" })
    await userEvent.type(input, "19")
    await expect(canvas.getByText("Colonization requires at least 20 Strength")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, "20")
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeEnabled()
    await userEvent.clear(input)
    await userEvent.type(input, "35")
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{"force":35}}]')
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent(":15")
    await userEvent.clear(input)
    await userEvent.type(input, "19")
    await expect(canvas.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{"force":35}}]')
    await userEvent.click(canvas.getByRole("button", { name: "Selected" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent("[]")
  },
}
/** Alternate content changes both displayed loss and live threshold without app rules. */
export const ColonizeConfigured25: Story = {
  render: () => <FleetActionExample initialView={createColonizeActionCardScenario({ requiredStrength: 25 }).view} actionId="Y" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText(/consuming exactly 25 Strength/)).toBeVisible()
    await userEvent.type(canvas.getByRole("combobox", { name: "Route target" }), "Boundary")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    const input = canvas.getByRole("spinbutton", { name: "Force" })
    await userEvent.type(input, "24")
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, "25")
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{"force":25}}]')
  },
}
/** Same-location singleton is selectable after source settlement, with no numeric input. */
export const StationaryColonize: Story = {
  render: () => <FleetActionExample initialView={createColonizeActionCardScenario({ stationary: true, strength: 20 }).view} actionId="Y" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText(/Reserve 20 Strength/)).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeEnabled()
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{}}]')
  },
}

/** Under-strength stations are excluded and changing the source clears the dependent world. */
export const ColonizeCandidates: Story = {
  render: () => {
    const fixture = createColonizeActionCardScenario({ stationary: true, strength: 20 })
    const second = createFleetStub({
      ...fixture.view.fleets[0],
      id: "second-source",
      name: "Other station",
      originPlanetId: fixture.scenario.second.id,
      strength: 20,
    })
    const weak = createFleetStub({ ...second, id: "weak-source", name: "Weak station", strength: 19 })
    return <FleetActionExample initialView={{ ...fixture.view, fleets: [...fixture.view.fleets, second, weak] }} actionId="Y" />
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole("combobox", { name: "Craft target" }))
    await expect(body.queryByRole("option", { name: /Fleet weak-sou/ })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole("option", { name: /Fleet source/ }))
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await expect(body.getAllByRole("option")).toHaveLength(1)
    await userEvent.click(body.getByRole("option", { name: /Boundary/ }))
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeEnabled()
    await userEvent.click(canvas.getByRole("combobox", { name: "Craft target" }))
    await userEvent.click(body.getByRole("option", { name: /Fleet second-s/ }))
    await expect(canvas.getByRole("combobox", { name: "Route target" })).toHaveValue("")
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await expect(body.getAllByRole("option")).toHaveLength(1)
    await userEvent.click(body.getByRole("option", { name: /Other/ }))
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent("Other station:0")
  },
}
/** A stationary20 reservation leaves30 from source50. */
export const StationaryBudget: Story = {
  render: () => <FleetActionExample initialView={createColonizeActionCardScenario({ stationary: true }).view} actionId="Y" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent(":30")
    await userEvent.click(canvas.getByRole("button", { name: "Selected" }))
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent(":50")
  },
}

/** Configured stationary25 excludes24 and settles only its valid source before destination selection. */
export const StationaryConfigured25: Story = {
  render: () => {
    const fixture = createColonizeActionCardScenario({ requiredStrength: 25, stationary: true, strength: 24 })
    const source = createFleetStub({ ...fixture.view.fleets[0], id: "valid25", name: "Valid station", strength: 25 })
    return <FleetActionExample initialView={{ ...fixture.view, fleets: [...fixture.view.fleets, source] }} actionId="Y" />
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText(/Reserve 25 Strength/)).toBeVisible()
    await expect(canvas.getByRole("combobox", { name: "Craft target" })).toHaveValue("Fleet valid25 (25 strength)")
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeDisabled()
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Boundary/ }))
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent("Valid station:0")
  },
}

/**
 * Distinct own and enemy claimed destinations are excluded independently of the source no-op prohibition.
 */
export const ColonizeUnclaimedDestination: Story = {
  render: () => <FleetActionExample initialView={createColonizeOwnershipScenario().view} actionId="Y" />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole("combobox", { name: "Craft target" })).toHaveValue("Fleet source (50 strength)")
    await userEvent.type(canvas.getByRole("spinbutton", { name: "Force" }), "35")
    await userEvent.click(canvas.getByRole("combobox", { name: "Route target" }))
    const options = within(canvasElement.ownerDocument.body)
    await expect(options.getAllByRole("option")).toHaveLength(1)
    await expect(options.queryByRole("option", { name: /Owned destination/ })).not.toBeInTheDocument()
    await expect(options.queryByRole("option", { name: /Enemy destination/ })).not.toBeInTheDocument()
    await userEvent.click(options.getByRole("option", { name: /Unclaimed destination/ }))
    await expect(canvas.getByRole("button", { name: "Select action" })).toBeEnabled()
    await userEvent.click(canvas.getByRole("button", { name: "Select action" }))
    await expect(canvas.getByRole("combobox", { name: "Route target" })).toHaveValue("Unclaimed destination (0:0:0)")
    await expect(canvas.getByRole("status", { name: "Saved orders" })).toHaveTextContent('[{"id":"Y","inputs":{"force":35}}]')
    await expect(canvas.getByRole("status", { name: "Uncommitted fleet strength" })).toHaveTextContent(":15")
  },
}

function FleetOperationsExample({
  alternate = false,
  maximumDistance = 18,
}: {
  alternate?: boolean
  maximumDistance?: number
}): ReactElement {
  const checkpoint = createFleetOperationsCardCheckpoint(alternate, maximumDistance)
  const [view, setView] = useState(checkpoint.view)
  const ids = alternate
    ? ["EXPAND_1", "ENGAGE_1", "ENGAGE_2", "MOVE_FLEET_EXCEPTIONAL_1"]
    : ["COLONIZE_PLANET_STANDARD_1", "ATTACK_MOVE_STANDARD_1", "MOVE_FLEET_EXCEPTIONAL_1", "MOVE_FLEET_STANDARD_1"]
  const allocations = computeActionCommitments({ ruleset: view.ruleset, actions: toActionEligibilityState(view).submittedActions })
  return (
    <>
      {view.actions
        .filter((action) => ids.includes(action.id))
        .map((action) => (
          <section key={action.id} aria-label={action.id}>
            <ActionCard
              action={action}
              actionDefinition={view.ruleset.actionDefinitions[action.actionDefinitionId]}
              playerView={view}
              players={checkpoint.players}
              resources={view.resources}
              canAfford={action.canAffordResources}
              isSelected={action.status === "SUBMITTED"}
              disabled={false}
              onSelect={(selectedTargets, selectedInputs) => {
                setView(
                  projectStorySubmissions(
                    view,
                    view.actions.map((candidate) =>
                      candidate.id === action.id
                        ? { ...candidate, selectedTargets, selectedInputs, status: selectedTargets === null ? "AVAILABLE" : "SUBMITTED" }
                        : candidate,
                    ),
                  ),
                )
              }}
            />
          </section>
        ))}
      <output aria-label="Checkpoint budget">
        {JSON.stringify({
          allocated: Object.values(allocations.strength).reduce((total, value) => total + value, 0),
          available: 80 - Object.values(allocations.strength).reduce((total, value) => total + value, 0),
          influence: view.resources.INFLUENCE.uncommitted,
          fuel: view.resources.FUEL.uncommitted,
        })}
      </output>
      <output aria-label="Checkpoint orders">
        {JSON.stringify(view.actions.filter((action) => action.status === "SUBMITTED").map((action) => [action.id, action.selectedInputs]))}
      </output>
    </>
  )
}

/** The same literal T12 public checkpoint protects replacement and precise cancellation release. */
export const PublicLifecycleCheckpoint: Story = {
  render: () => <FleetOperationsExample />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const attack = within(canvas.getByRole("region", { name: "ATTACK_MOVE_STANDARD_1" }))
    const input = attack.getByRole("spinbutton", { name: "Strength" })
    const budget = canvas.getByRole("status", { name: "Checkpoint budget" })
    await expect(budget).toHaveTextContent('{"allocated":70,"available":10,"influence":5,"fuel":0}')
    await userEvent.clear(input)
    await userEvent.type(input, "40")
    await userEvent.click(attack.getByRole("button", { name: "Update action" }))
    await expect(budget).toHaveTextContent('{"allocated":80,"available":0,"influence":5,"fuel":0}')
    await userEvent.clear(input)
    await userEvent.type(input, "41")
    await expect(attack.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(attack.getByText(/shortfall 1|missing 1|Insufficient Fleet Strength/i)).toBeVisible()
    await expect(canvas.getByRole("status", { name: "Checkpoint orders" })).toHaveTextContent('["ATTACK_MOVE_STANDARD_1",{"strength":40}]')
    await userEvent.clear(input)
    await userEvent.type(input, "30")
    await userEvent.click(attack.getByRole("button", { name: "Update action" }))
    await userEvent.click(attack.getByRole("button", { name: /^Selected$/ }))
    await expect(budget).toHaveTextContent('{"allocated":40,"available":40,"influence":10,"fuel":1}')
    await userEvent.type(attack.getByRole("combobox", { name: "Planet target" }), "Left home")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Left home/ }))
    await userEvent.type(attack.getByRole("spinbutton", { name: "Strength" }), "30")
    await userEvent.click(attack.getByRole("button", { name: "Select action" }))
    await expect(budget).toHaveTextContent('{"allocated":70,"available":10,"influence":5,"fuel":0}')
    const projected = toActionEligibilityState(createFleetOperationsCardCheckpoint().view)
    await expect(projected.players[projected.submittedActions[0]?.playerId ?? ""]?.resources).toStrictEqual({
      INFLUENCE: 38,
      METAL: 2,
      FUEL: 6,
      ENERGY: 0,
      COLONY: 0,
    })
    const result = resolveTurn(
      structuredClone({ ...projected, winnerPlayerId: undefined }),
      typedParse(RulesetSchema, createFleetOperationsCardCheckpoint().view.ruleset),
      createSeededRng(1234),
    )
    await expect(result).toMatchObject({ type: "Success" })
    const invalid = structuredClone({ ...projected, winnerPlayerId: undefined })
    const action = invalid.submittedActions.find((action) => action.id === "ATTACK_MOVE_STANDARD_1")
    if (action === undefined) throw new Error("Missing reviewed Attack")
    Reflect.set(action, "selectedInputs", { strength: 41 })
    const resources = structuredClone(invalid.players)
    await expect(
      resolveTurn(invalid, typedParse(RulesetSchema, createFleetOperationsCardCheckpoint().view.ruleset), createSeededRng(1234)),
    ).toMatchObject({ type: "Failure", error: { type: "INVALID_SUBMISSIONS" } })
    await expect(invalid.players).toStrictEqual(resources)
  },
}

/** Renamed configured content shares the real checkpoint and two independent instances. */
export const AlternatePublicCheckpoint: Story = {
  render: () => <FleetOperationsExample alternate />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const expand = within(canvas.getByRole("region", { name: "EXPAND_1" })),
      x = within(canvas.getByRole("region", { name: "ENGAGE_1" })),
      y = within(canvas.getByRole("region", { name: "ENGAGE_2" }))
    const budget = canvas.getByRole("status", { name: "Checkpoint budget" })
    await expect(expand.getByText(/consuming exactly 25 Strength/)).toBeVisible()
    await expect(expand.getByText(/9 light years per turn/)).toBeVisible()
    await expect(expand.getByText(/Range 18 light years/)).toBeVisible()
    await expect(budget).toHaveTextContent('{"allocated":80,"available":0,"influence":3,"fuel":1}')
    await userEvent.clear(expand.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(expand.getByRole("spinbutton", { name: "Force" }), "24")
    await expect(expand.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(expand.getByText("Colonization requires at least 25 Strength")).toBeVisible()
    await userEvent.clear(expand.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(expand.getByRole("spinbutton", { name: "Force" }), "25")
    await expect(expand.getByRole("button", { name: "Update action" })).toBeEnabled()
    await userEvent.clear(expand.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(expand.getByRole("spinbutton", { name: "Force" }), "35")
    await userEvent.clear(y.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(y.getByRole("spinbutton", { name: "Force" }), "11")
    await expect(y.getByRole("button", { name: "Update action" })).toBeDisabled()
    await expect(budget).toHaveTextContent('{"allocated":80,"available":0,"influence":3,"fuel":1}')
    await userEvent.clear(y.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(y.getByRole("spinbutton", { name: "Force" }), "10")
    await userEvent.clear(x.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(x.getByRole("spinbutton", { name: "Force" }), "25")
    await userEvent.click(x.getByRole("button", { name: "Update action" }))
    await expect(budget).toHaveTextContent('{"allocated":75,"available":5,"influence":3,"fuel":1}')
    await userEvent.clear(x.getByRole("spinbutton", { name: "Force" }))
    await userEvent.type(x.getByRole("spinbutton", { name: "Force" }), "30")
    await userEvent.click(x.getByRole("button", { name: "Update action" }))
    await expect(budget).toHaveTextContent('{"allocated":80,"available":0,"influence":3,"fuel":1}')
    await userEvent.click(y.getByRole("button", { name: /^Selected$/ }))
    await expect(budget).toHaveTextContent('{"allocated":70,"available":10,"influence":7,"fuel":1}')
    await userEvent.type(y.getByRole("combobox", { name: "World target" }), "Left home")
    await userEvent.click(within(canvasElement.ownerDocument.body).getByRole("option", { name: /Left home/ }))
    await userEvent.type(y.getByRole("spinbutton", { name: "Force" }), "10")
    await userEvent.click(y.getByRole("button", { name: "Select action" }))
    await expect(budget).toHaveTextContent('{"allocated":80,"available":0,"influence":3,"fuel":1}')
    const fixture = createFleetOperationsCardCheckpoint(true),
      state = toActionEligibilityState(fixture.view)
    await expect(
      resolveTurn(
        structuredClone({ ...state, winnerPlayerId: undefined }),
        typedParse(RulesetSchema, fixture.view.ruleset),
        createSeededRng(1234),
      ),
    ).toMatchObject({ type: "Success" })
  },
}

/** Range17 excludes both generated long routes in the actual renamed TargetPicker. */
export const AlternatePublicRange17: Story = {
  render: () => <FleetOperationsExample alternate maximumDistance={17} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const expand = within(canvas.getByRole("region", { name: "EXPAND_1" })),
      attack = within(canvas.getByRole("region", { name: "ENGAGE_1" }))
    for (const card of [expand, attack]) {
      await userEvent.click(card.getByRole("combobox", { name: "World target" }))
      const body = within(canvasElement.ownerDocument.body)
      await expect(body.queryByRole("option", { name: /Unclaimed destination/ })).not.toBeInTheDocument()
      await expect(body.queryByRole("option", { name: /Left home/ })).not.toBeInTheDocument()
      await userEvent.keyboard("{Escape}")
    }
    const fixture = createFleetOperationsCardCheckpoint(true, 17),
      state = toActionEligibilityState(fixture.view),
      resources = structuredClone(state.players)
    const working = { ...structuredClone(state), winnerPlayerId: undefined }
    await expect(resolveTurn(working, typedParse(RulesetSchema, fixture.view.ruleset), createSeededRng(1234))).toMatchObject({
      type: "Failure",
      error: { type: "INVALID_SUBMISSIONS" },
    })
    await expect(working.players).toStrictEqual(resources)
  },
}
