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
import { createAttackActionCardScenario, createFleetActionCardScenario } from "./ActionCard.stub.ts"
import { ActionCard } from "./ActionCard.tsx"

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
