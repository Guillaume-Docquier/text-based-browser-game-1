import { branded } from "@guillaume-docquier/tools-ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import { getPlanetDistance } from "#shared/domain/world/planets/getPlanetDistance.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"
import type { ResolutionPlanet } from "#shared/turn-resolution/state/ResolutionPlanet.ts"

export type ActionEligibilityState = Readonly<{
  gameId: GameId
  turn: number
  players: Readonly<Record<PlayerId, { readonly id: PlayerId; readonly resources: Readonly<Resources> }>>
  planets: Readonly<Record<PlanetId, ResolutionPlanet>>
  fleets: Readonly<Record<FleetId, Readonly<Fleet>>>
  submittedActions: readonly SubmittedAction[]
}>
export type ActionIdentity = Pick<SubmittedAction, "id" | "playerId" | "actionDefinitionId">
export type ActionSelectionDraft = Readonly<{
  selectedTargets: Readonly<Record<string, string | undefined>>
  selectedInputs: Readonly<Record<string, unknown>>
}>
export type ActionEligibilityIssue = Readonly<{
  path: readonly string[]
  status: "invalid" | "incomplete" | "dependency-pending"
  message: string
  shortfall?: number
}>
export type ActionCommitments = Readonly<{
  resources: Readonly<Record<PlayerId, Readonly<Resources>>>
  strength: Readonly<Record<FleetId, number>>
}>
const emptyResources = (): Resources => ({ INFLUENCE: 0, METAL: 0, FUEL: 0, ENERGY: 0, COLONY: 0 })

/** One accounting path for complete sets, replacements and player presentation. */
export function computeActionCommitments({
  ruleset,
  actions,
}: {
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">
  actions: ReadonlyArray<ActionIdentity & ActionSelectionDraft>
}): ActionCommitments {
  const resources: Record<PlayerId, Resources> = {}
  const strength: Record<FleetId, number> = {}
  for (const action of actions) {
    const definition = ruleset.actionDefinitions[action.actionDefinitionId]
    if (definition === undefined) continue
    const committed = (resources[action.playerId] ??= emptyResources())
    for (const cost of definition.costs) committed[cost.parameters.resourceType] += cost.parameters.quantity
    for (const [tag, input] of Object.entries(definition.inputs)) {
      const amount = action.selectedInputs[tag]
      const fleetId = action.selectedTargets[input.fleetTargetTag]
      if (fleetId !== undefined && typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0) {
        const id = branded<FleetId>(fleetId)
        strength[id] = (strength[id] ?? 0) + amount
      }
    }
  }
  return { resources, strength }
}
export function replaceActionSubmission(
  actions: readonly SubmittedAction[],
  candidate: SubmittedAction | null,
  identity: ActionIdentity,
): readonly SubmittedAction[] {
  const others = actions.filter((action) => action.playerId !== identity.playerId || action.id !== identity.id)
  return candidate === null ? others : [...others, candidate]
}
export function isActionOccupied(state: Pick<ActionEligibilityState, "fleets">, action: Pick<ActionIdentity, "id" | "playerId">): boolean {
  return Object.values(state.fleets).some(
    (fleet) =>
      fleet.strength > 0 && fleet.movement?.submittedAction.playerId === action.playerId && fleet.movement.submittedAction.id === action.id,
  )
}
type EvaluationContext = {
  state: ActionEligibilityState
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">
  action: ActionIdentity
  selection: ActionSelectionDraft
  mode: "draft" | "complete"
}
export function evaluateActionSelection({ state, ruleset, action, selection, mode }: EvaluationContext): {
  issues: ActionEligibilityIssue[]
  eligible: boolean
  commitments: ActionCommitments
  availableStrength: Readonly<Record<FleetId, number>>
} {
  const issues: ActionEligibilityIssue[] = []
  const add = (path: string[], message: string, status: ActionEligibilityIssue["status"] = "invalid", shortfall?: number): void => {
    issues.push({ path, message, status, ...(shortfall === undefined ? {} : { shortfall }) })
  }
  const missing = mode === "draft" ? "incomplete" : "invalid"
  const definition = ruleset.actionDefinitions[action.actionDefinitionId]
  const others = state.submittedActions.filter((other) => other.playerId !== action.playerId || other.id !== action.id)
  const commitments = computeActionCommitments({ ruleset, actions: [...others, { ...action, ...selection }] })
  const availableStrength: Record<FleetId, number> = {}
  for (const fleet of Object.values(state.fleets)) availableStrength[fleet.id] = fleet.strength - (commitments.strength[fleet.id] ?? 0)
  if (definition === undefined) add(["actionDefinitionId"], "Unknown Action Definition")
  if (state.players[action.playerId] === undefined) add(["playerId"], "Unknown player")
  if (!ruleset.actionPool.some((entry) => entry.id === action.id && entry.actionDefinitionId === action.actionDefinitionId))
    add(["id"], "Invalid action instance or definition binding")
  if (isActionOccupied(state, action)) add(["id"], "Action is in progress and cannot be changed")
  if (definition !== undefined) {
    for (const tag of Object.keys(selection.selectedTargets))
      if (definition.targets[branded<TargetTag>(tag)] === undefined) add(["selectedTargets", tag], "Unexpected target")
    for (const tag of Object.keys(selection.selectedInputs))
      if (definition.inputs[branded<InputTag>(tag)] === undefined) add(["selectedInputs", tag], "Unexpected input")
    for (const [tag, slot] of Object.entries(definition.targets)) {
      const path = ["selectedTargets", tag]
      const id = selection.selectedTargets[tag]
      if (id === undefined) {
        add(path, "Choose a target", missing)
        continue
      }
      const target =
        slot.targetType === "FLEET"
          ? state.fleets[branded<FleetId>(id)]
          : slot.targetType === "PLANET"
            ? state.planets[branded<PlanetId>(id)]
            : state.players[branded<PlayerId>(id)]
      if (target === undefined) {
        add(path, `Unknown ${slot.targetType} target`)
        continue
      }
      for (const constraint of slot.constraints) {
        if (constraint.type === "OWNED_BY_SUBMITTING_PLAYER" && (!("ownerPlayerId" in target) || target.ownerPlayerId !== action.playerId))
          add(path, "Target must be owned by submitting player")
        if (constraint.type === "STATIONARY_FLEET") {
          const fleet = state.fleets[branded<FleetId>(id)]
          if (fleet === undefined || fleet.destinationPlanetId !== undefined || fleet.movement !== undefined)
            add(path, "Source fleet must be stationary")
          if (fleet !== undefined && fleet.strength <= 0) add(path, "Source fleet has no available strength")
          if (fleet !== undefined && state.planets[fleet.originPlanetId] === undefined) add(path, "Source origin planet is missing")
          const othersCommitments = computeActionCommitments({ ruleset, actions: others })
          if (fleet !== undefined && fleet.strength - (othersCommitments.strength[fleet.id] ?? 0) <= 0)
            add(path, "Source fleet has no available strength")
        }
        if (constraint.type === "WITHIN_FLEET_RANGE") {
          const sourceId = selection.selectedTargets[constraint.fleetTargetTag]
          if (sourceId === undefined) {
            add(path, "Choose a source fleet first", mode === "draft" ? "dependency-pending" : "invalid")
            continue
          }
          const source = state.fleets[branded<FleetId>(sourceId)]
          const origin = source === undefined ? undefined : state.planets[source.originPlanetId]
          const destination = state.planets[branded<PlanetId>(id)]
          if (origin === undefined || destination === undefined) {
            add(path, "Source origin or destination is missing")
            continue
          }
          if (origin.id === destination.id) add(path, "Destination must differ from the origin planet")
          const distance = getPlanetDistance(origin, destination)
          if (!Number.isFinite(distance) || distance > constraint.maximumDistance)
            add(path, `Destination exceeds range ${constraint.maximumDistance} light years`)
        }
      }
    }
    for (const [tag, input] of Object.entries(definition.inputs)) {
      const value = selection.selectedInputs[tag]
      const path = ["selectedInputs", tag]
      if (value === undefined) add(path, "Choose strength", missing)
      else if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
        add(path, "Strength must be a positive safe whole number")
      const sourceId = selection.selectedTargets[input.fleetTargetTag]
      const source = sourceId === undefined ? undefined : state.fleets[branded<FleetId>(sourceId)]
      if (source !== undefined && (commitments.strength[source.id] ?? 0) > source.strength) {
        const shortfall = (commitments.strength[source.id] ?? 0) - source.strength
        add(path, `Insufficient fleet strength: shortfall ${shortfall}`, "invalid", shortfall)
      }
    }
    const totals = state.players[action.playerId]?.resources
    if (totals !== undefined)
      for (const resource of Object.values(ResourceType)) {
        const shortfall = (commitments.resources[action.playerId]?.[resource] ?? 0) - totals[resource]
        if (shortfall > 0) add(["resources", resource], `Insufficient ${resource}: shortfall ${shortfall}`, "invalid", shortfall)
      }
  }
  return { issues, eligible: issues.length === 0, commitments, availableStrength }
}
export function evaluateTargetSelection(context: Omit<EvaluationContext, "mode"> & { targetTag: TargetTag; targetId: string }): {
  status: "eligible" | "ineligible" | "dependency-pending"
  issues: ActionEligibilityIssue[]
} {
  const selection = {
    ...context.selection,
    selectedTargets: { ...context.selection.selectedTargets, [context.targetTag]: context.targetId },
  }
  const evaluation = evaluateActionSelection({ ...context, selection, mode: "draft" })
  // A destination retains its declared source prerequisites; source candidates ignore stale dependent drafts.
  const candidateSlot = context.ruleset.actionDefinitions[context.action.actionDefinitionId]?.targets[context.targetTag]
  const relevantTargetTags = new Set<string>([context.targetTag])
  for (const constraint of candidateSlot?.constraints ?? [])
    if (constraint.type === "WITHIN_FLEET_RANGE") relevantTargetTags.add(constraint.fleetTargetTag)
  const issues = evaluation.issues.filter(
    (issue) =>
      issue.path[0] === "id" ||
      issue.path[0] === "playerId" ||
      issue.path[0] === "actionDefinitionId" ||
      (issue.path[0] === "selectedTargets" && issue.path[1] !== undefined && relevantTargetTags.has(issue.path[1])),
  )
  return {
    status: issues.some((issue) => issue.status === "invalid") ? "ineligible" : issues.length > 0 ? "dependency-pending" : "eligible",
    issues,
  }
}
export function evaluateSubmittedActions({
  state,
  ruleset,
  submittedActions,
}: {
  state: ActionEligibilityState
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">
  submittedActions: readonly SubmittedAction[]
}): Array<{ action: SubmittedAction; issues: ActionEligibilityIssue[] }> {
  const results = submittedActions.map((action) => ({
    action,
    issues: evaluateActionSelection({ state: { ...state, submittedActions }, ruleset, action, selection: action, mode: "complete" }).issues,
  }))
  const seen = new Set<string>()
  for (const result of results) {
    const key = JSON.stringify([result.action.playerId, result.action.id])
    if (seen.has(key)) result.issues.push({ path: ["id"], status: "invalid", message: "Duplicate action instance" })
    seen.add(key)
  }
  return results
}
