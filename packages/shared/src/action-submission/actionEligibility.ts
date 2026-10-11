import { branded } from "@guillaume-docquier/tools-ts"
import { evaluateColonization, isUnclaimedPlanet } from "#shared/action-submission/colonizationEligibility.ts"
import type { GameId } from "#shared/domain/games/GameId.ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import type { ActionDefinition } from "#shared/domain/ruleset/action-definitions/ActionDefinition.ts"
import type { InputTag } from "#shared/domain/ruleset/action-definitions/InputTag.ts"
import type { TargetTag } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import { getFleetTargetDependency } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import type { TargetDefinition } from "#shared/domain/ruleset/target-definitions/TargetDefinition.ts"
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
type CommitmentAction = ActionIdentity & ActionSelectionDraft
const emptyResources = (): Resources => ({ INFLUENCE: 0, METAL: 0, FUEL: 0, ENERGY: 0, COLONY: 0 })
/** One accounting path for complete sets, replacements and player presentation. */
export function computeActionCommitments({
  ruleset,
  actions,
}: {
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">
  actions: readonly CommitmentAction[]
}): ActionCommitments {
  const resources: Record<PlayerId, Resources> = {},
    strength: Record<FleetId, number> = {}
  for (const action of actions) {
    const definition = ruleset.actionDefinitions[action.actionDefinitionId]
    if (definition === undefined) continue
    reserveStationaryColonization(strength, { action, definition })
    accumulateResourceCosts(resources, { action, definition })
    reserveMovementInputs(strength, { action, definition })
  }
  return { resources, strength }
}
type DefinedCommitment = { action: CommitmentAction; definition: ActionDefinition }
function addStrengthReservation(strength: Record<FleetId, number>, fleetId: string | undefined, amount: number): void {
  if (fleetId === undefined) return
  const id = branded<FleetId>(fleetId)
  strength[id] = (strength[id] ?? 0) + amount
}
function reserveStationaryColonization(strength: Record<FleetId, number>, { action, definition }: DefinedCommitment): void {
  if (definition.effects.some((effect) => effect.type === "FLEET_MOVE")) return
  for (const colonize of definition.effects.filter((effect) => effect.type === "COLONIZE"))
    addStrengthReservation(strength, action.selectedTargets[colonize.targets.fleet.actionTargetTag], colonize.parameters.requiredStrength)
}
function accumulateResourceCosts(resources: Record<PlayerId, Resources>, { action, definition }: DefinedCommitment): void {
  const committed = (resources[action.playerId] ??= emptyResources())
  for (const cost of definition.costs) committed[cost.parameters.resourceType] += cost.parameters.quantity
}
function positiveWholeStrength(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}
function reserveMovementInputs(strength: Record<FleetId, number>, { action, definition }: DefinedCommitment): void {
  for (const [tag, input] of Object.entries(definition.inputs)) {
    const amount = action.selectedInputs[tag]
    if (!positiveWholeStrength(amount)) continue
    addStrengthReservation(strength, action.selectedTargets[input.fleetTargetTag], amount)
  }
}
export function replaceActionSubmission(
  actions: readonly SubmittedAction[],
  candidate: SubmittedAction | null,
  identity: ActionIdentity,
): readonly SubmittedAction[] {
  const others = excludingInstance(actions, identity)
  return candidate === null ? others : [...others, candidate]
}
function excludingInstance(actions: readonly SubmittedAction[], identity: ActionIdentity): SubmittedAction[] {
  return actions.filter((action) => action.playerId !== identity.playerId || action.id !== identity.id)
}
export function isActionOccupied(state: Pick<ActionEligibilityState, "fleets">, action: Pick<ActionIdentity, "id" | "playerId">): boolean {
  return Object.values(state.fleets).some((fleet) => occupiesInstance(fleet, action))
}
function occupiesInstance(fleet: Readonly<Fleet>, action: Pick<ActionIdentity, "id" | "playerId">): boolean {
  if (!(fleet.strength > 0)) return false
  if (fleet.movement?.submittedAction.playerId !== action.playerId) return false
  return fleet.movement.submittedAction.id === action.id
}
type EvaluationContext = {
  state: ActionEligibilityState
  ruleset: Pick<Ruleset, "actionDefinitions" | "actionPool">
  action: ActionIdentity
  selection: ActionSelectionDraft
  mode: "draft" | "complete"
}
type IssueCollector = (path: string[], message: string, status?: ActionEligibilityIssue["status"], shortfall?: number) => void
type SelectionValidation = EvaluationContext & { add: IssueCollector; commitments: ActionCommitments; otherCommitments: ActionCommitments }
type DefinedValidation = SelectionValidation & { definition: ActionDefinition }
export function evaluateActionSelection(context: EvaluationContext): {
  issues: ActionEligibilityIssue[]
  eligible: boolean
  commitments: ActionCommitments
  availableStrength: Readonly<Record<FleetId, number>>
} {
  const issues: ActionEligibilityIssue[] = []
  const add: IssueCollector = (path, message, status = "invalid", shortfall): void => {
    issues.push({ path, message, status, ...(shortfall === undefined ? {} : { shortfall }) })
  }
  const others = excludingInstance(context.state.submittedActions, context.action)
  const otherCommitments = computeActionCommitments({ ruleset: context.ruleset, actions: others })
  const commitments = computeActionCommitments({
    ruleset: context.ruleset,
    actions: [...others, { ...context.action, ...context.selection }],
  })
  const validation = { ...context, add, commitments, otherCommitments }
  const definition = context.ruleset.actionDefinitions[context.action.actionDefinitionId]
  validateActionIdentity(validation, definition)
  if (definition !== undefined) validateDeclaredSelection({ ...validation, definition })
  return { issues, eligible: issues.length === 0, commitments, availableStrength: remainingFleetStrength(context.state, commitments) }
}
function remainingFleetStrength(state: ActionEligibilityState, commitments: ActionCommitments): Record<FleetId, number> {
  return Object.fromEntries(Object.values(state.fleets).map((fleet) => [fleet.id, fleet.strength - (commitments.strength[fleet.id] ?? 0)]))
}
function validateActionIdentity({ state, ruleset, action, add }: SelectionValidation, definition: ActionDefinition | undefined): void {
  if (definition === undefined) add(["actionDefinitionId"], "Unknown Action Definition")
  if (state.players[action.playerId] === undefined) add(["playerId"], "Unknown player")
  if (!ruleset.actionPool.some((entry) => entry.id === action.id && entry.actionDefinitionId === action.actionDefinitionId))
    add(["id"], "Invalid action instance or definition binding")
  if (isActionOccupied(state, action)) add(["id"], "Action is in progress and cannot be changed")
}
function validateDeclaredSelection(context: DefinedValidation): void {
  validateUnexpectedSelections(context)
  for (const [tag, slot] of Object.entries(context.definition.targets)) validateTargetSlot(context, { tag, slot })
  for (const [tag, input] of Object.entries(context.definition.inputs))
    validateStrengthInput(context, { tag, sourceTag: input.fleetTargetTag })
  validateColonizationForce(context)
  validateResourceBudget(context)
}
function validateUnexpectedSelections({ definition, selection, add }: DefinedValidation): void {
  for (const tag of Object.keys(selection.selectedTargets))
    if (definition.targets[branded<TargetTag>(tag)] === undefined) add(["selectedTargets", tag], "Unexpected target")
  for (const tag of Object.keys(selection.selectedInputs))
    if (definition.inputs[branded<InputTag>(tag)] === undefined) add(["selectedInputs", tag], "Unexpected input")
}
function missingSelectionStatus(context: EvaluationContext): ActionEligibilityIssue["status"] {
  return context.mode === "draft" ? "incomplete" : "invalid"
}
function dependencyStatus(context: EvaluationContext): ActionEligibilityIssue["status"] {
  return context.mode === "draft" ? "dependency-pending" : "invalid"
}
function lookupTarget(
  state: ActionEligibilityState,
  type: TargetDefinition["targetType"],
  id: string,
): Readonly<Fleet> | ResolutionPlanet | ActionEligibilityState["players"][PlayerId] | undefined {
  switch (type) {
    case "FLEET":
      return state.fleets[branded<FleetId>(id)]
    case "PLANET":
      return state.planets[branded<PlanetId>(id)]
    case "PLAYER":
      return state.players[branded<PlayerId>(id)]
  }
}
type TargetValidation = DefinedValidation & { path: string[]; id: string; target: NonNullable<ReturnType<typeof lookupTarget>> }
function validateTargetSlot(context: DefinedValidation, { tag, slot }: { tag: string; slot: TargetDefinition }): void {
  const path = ["selectedTargets", tag],
    id = context.selection.selectedTargets[tag]
  if (id === undefined) {
    context.add(path, "Choose a target", missingSelectionStatus(context))
    return
  }
  const target = lookupTarget(context.state, slot.targetType, id)
  if (target === undefined) {
    context.add(path, `Unknown ${slot.targetType} target`)
    return
  }
  for (const constraint of slot.constraints) validateTargetConstraint({ ...context, path, id, target }, constraint)
}
function validateTargetConstraint(context: TargetValidation, constraint: TargetConstraint): void {
  switch (constraint.type) {
    case "OWNED_BY_SUBMITTING_PLAYER": {
      validateTargetOwner(context)
      return
    }
    case "STATIONARY_FLEET": {
      validateStationarySource(context)
      return
    }
    case "UNCLAIMED_PLANET": {
      validateUnclaimedTarget(context)
      return
    }
    case "AT_FLEET_PLANET": {
      validateSourceLocation(context, constraint.fleetTargetTag)
      return
    }
    case "WITHIN_FLEET_RANGE": {
      validateSourceRange(context, constraint)
      return
    }
  }
}
function validateTargetOwner({ target, action, add, path }: TargetValidation): void {
  if (!("ownerPlayerId" in target) || target.ownerPlayerId !== action.playerId) add(path, "Target must be owned by submitting player")
}
function validateUnclaimedTarget({ target, add, path }: TargetValidation): void {
  if (!("ownerPlayerId" in target) || !isUnclaimedPlanet(target.ownerPlayerId)) add(path, "Planet is already claimed")
}
function isStationary(fleet: Readonly<Fleet> | undefined): boolean {
  if (fleet === undefined) return false
  return fleet.destinationPlanetId === undefined && fleet.movement === undefined
}
function validateStationarySource(context: TargetValidation): void {
  const fleet = context.state.fleets[branded<FleetId>(context.id)]
  if (!isStationary(fleet)) context.add(context.path, "Source fleet must be stationary")
  if (fleet === undefined) return
  if (fleet.strength <= 0) context.add(context.path, "Source fleet has no available strength")
  if (context.state.planets[fleet.originPlanetId] === undefined) context.add(context.path, "Source origin planet is missing")
  if (fleet.strength - (context.otherCommitments.strength[fleet.id] ?? 0) <= 0)
    context.add(context.path, "Source fleet has no available strength")
}
function selectedSource(context: SelectionValidation, tag: string): Readonly<Fleet> | undefined {
  const id = context.selection.selectedTargets[tag]
  return id === undefined ? undefined : context.state.fleets[branded<FleetId>(id)]
}
function validateSourceLocation(context: TargetValidation, sourceTag: string): void {
  if (context.selection.selectedTargets[sourceTag] === undefined) {
    context.add(context.path, "Choose a source fleet first", dependencyStatus(context))
    return
  }
  if (selectedSource(context, sourceTag)?.originPlanetId !== context.id) context.add(context.path, "Planet must be at the source fleet")
}
function validateSourceRange(context: TargetValidation, constraint: Extract<TargetConstraint, { type: "WITHIN_FLEET_RANGE" }>): void {
  if (context.selection.selectedTargets[constraint.fleetTargetTag] === undefined) {
    context.add(context.path, "Choose a source fleet first", dependencyStatus(context))
    return
  }
  const source = selectedSource(context, constraint.fleetTargetTag),
    origin = source === undefined ? undefined : context.state.planets[source.originPlanetId],
    destination = context.state.planets[branded<PlanetId>(context.id)]
  if (origin === undefined || destination === undefined) {
    context.add(context.path, "Source origin or destination is missing")
    return
  }
  if (origin.id === destination.id) context.add(context.path, "Destination must differ from the origin planet")
  const distance = getPlanetDistance(origin, destination)
  if (!Number.isFinite(distance) || distance > constraint.maximumDistance)
    context.add(context.path, `Destination exceeds range ${constraint.maximumDistance} light years`)
}
function validateStrengthInput(context: DefinedValidation, { tag, sourceTag }: { tag: string; sourceTag: string }): void {
  const value = context.selection.selectedInputs[tag],
    path = ["selectedInputs", tag]
  if (value === undefined) context.add(path, "Choose strength", missingSelectionStatus(context))
  else if (!positiveWholeStrength(value)) context.add(path, "Strength must be a positive safe whole number")
  validateFleetBudget(context, { source: selectedSource(context, sourceTag), path })
}
function validateFleetBudget(
  context: SelectionValidation,
  { source, path }: { source: Readonly<Fleet> | undefined; path: string[] },
): void {
  if (source === undefined) return
  const shortfall = (context.commitments.strength[source.id] ?? 0) - source.strength
  if (shortfall > 0) context.add(path, `Insufficient fleet strength: shortfall ${shortfall}`, "invalid", shortfall)
}
type MoveDefinition = Extract<ActionDefinition["effects"][number], { type: "FLEET_MOVE" }>
function validateColonizationForce(context: DefinedValidation): void {
  const move = context.definition.effects.find((effect) => effect.type === "FLEET_MOVE")
  for (const colonize of context.definition.effects.filter((effect) => effect.type === "COLONIZE")) {
    const sourceTag = colonize.targets.fleet.actionTargetTag,
      source = selectedSource(context, sourceTag),
      planetId = context.selection.selectedTargets[colonize.targets.planet.actionTargetTag]
    const planet = planetId === undefined ? undefined : context.state.planets[branded<PlanetId>(planetId)]
    const amount = colonizationSelectionStrength(context, { source, move }),
      path = move === undefined ? ["selectedTargets", sourceTag] : ["selectedInputs", move.inputs.strength.actionInputTag]
    if (canEvaluateColonizationStrength(amount, move !== undefined))
      collectColonizationForceIssues(context, { colonize, planet, amount, path })
    if (move === undefined) validateFleetBudget(context, { source, path: ["selectedTargets", sourceTag] })
  }
}
function colonizationSelectionStrength(
  context: SelectionValidation,
  { source, move }: { source: Readonly<Fleet> | undefined; move: MoveDefinition | undefined },
): unknown {
  if (move !== undefined) return context.selection.selectedInputs[move.inputs.strength.actionInputTag]
  if (source === undefined) return undefined
  return source.strength - (context.otherCommitments.strength[source.id] ?? 0)
}
function canEvaluateColonizationStrength(amount: unknown, moving: boolean): amount is number {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount)) return false
  return !moving || amount > 0
}
function collectColonizationForceIssues(
  context: SelectionValidation,
  {
    colonize,
    planet,
    amount,
    path,
  }: {
    colonize: Extract<ActionDefinition["effects"][number], { type: "COLONIZE" }>
    planet: ResolutionPlanet | undefined
    amount: number
    path: string[]
  },
): void {
  for (const reason of evaluateColonization({ definition: colonize, ownerPlayerId: planet?.ownerPlayerId ?? null, strength: amount }))
    if (reason !== "Planet is already claimed") context.add(path, reason)
}
function validateResourceBudget(context: SelectionValidation): void {
  const totals = context.state.players[context.action.playerId]?.resources
  if (totals === undefined) return
  for (const resource of Object.values(ResourceType)) {
    const shortfall = (context.commitments.resources[context.action.playerId]?.[resource] ?? 0) - totals[resource]
    if (shortfall > 0) context.add(["resources", resource], `Insufficient ${resource}: shortfall ${shortfall}`, "invalid", shortfall)
  }
}
type TargetCandidateContext = Omit<EvaluationContext, "mode"> & { targetTag: TargetTag; targetId: string }
export function evaluateTargetSelection(context: TargetCandidateContext): {
  status: "eligible" | "ineligible" | "dependency-pending"
  issues: ActionEligibilityIssue[]
} {
  const selection = {
    ...context.selection,
    selectedTargets: { ...context.selection.selectedTargets, [context.targetTag]: context.targetId },
  }
  const evaluation = evaluateActionSelection({ ...context, selection, mode: "draft" }),
    relevant = candidatePrerequisites(context)
  const issues = evaluation.issues.filter((issue) => isCandidateIssue(issue, relevant))
  return { status: candidateStatus(issues), issues }
}
function candidatePrerequisites(context: TargetCandidateContext): Set<string> {
  const slot = context.ruleset.actionDefinitions[context.action.actionDefinitionId]?.targets[context.targetTag],
    relevant = new Set<string>([context.targetTag])
  for (const constraint of slot?.constraints ?? []) {
    const dependency = getFleetTargetDependency(constraint)
    if (dependency !== undefined) relevant.add(dependency)
  }
  return relevant
}
function isCandidateIssue(issue: ActionEligibilityIssue, relevant: ReadonlySet<string>): boolean {
  if (["id", "playerId", "actionDefinitionId"].includes(issue.path[0] ?? "")) return true
  if (issue.path[0] !== "selectedTargets" || issue.path[1] === undefined) return false
  return relevant.has(issue.path[1])
}
function candidateStatus(issues: readonly ActionEligibilityIssue[]): "eligible" | "ineligible" | "dependency-pending" {
  if (issues.some((issue) => issue.status === "invalid")) return "ineligible"
  return issues.length > 0 ? "dependency-pending" : "eligible"
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
