import { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import type { CompiledAction, CompiledRuleset } from "../compiler/CompiledRuleset.ts"
import { evaluateConstraints } from "../constraints/evaluateConstraints.ts"
import type { ExecutionState } from "./ExecutionContext.ts"
import { findTarget } from "./resolveTargets.ts"

export type ValidatedSubmission = Readonly<{ submission: SubmittedAction; action: CompiledAction }>
type ValidationContext = Readonly<{
  ruleset: CompiledRuleset
  state: ExecutionState
  remaining: Map<PlayerId, Resources>
  used: Map<PlayerId, Set<string>>
}>

/**
 * Checks pool membership, once-per-player opportunities, concrete targets and
 * combined spending. Same-turn gains cannot finance costs paid before Income.
 */
export function validateSubmissions(
  submissions: readonly SubmittedAction[],
  ruleset: CompiledRuleset,
  state: ExecutionState,
): Result<readonly ValidatedSubmission[], CompilationIssue[]> {
  const context: ValidationContext = { ruleset, state, remaining: new Map(), used: new Map() }
  const issues: CompilationIssue[] = []
  const validated: ValidatedSubmission[] = []
  for (const [index, submission] of submissions.entries()) {
    const result = validateSubmission(submission, ["submissions", index], context)
    if (Result.isFailure(result)) issues.push(...result.error)
    else validated.push(result.value)
  }
  return issues.length > 0 ? Result.Failure(issues) : Result.Success(validated)
}

function validateSubmission(
  submission: SubmittedAction,
  path: readonly PropertyKey[],
  context: ValidationContext,
): Result<ValidatedSubmission, CompilationIssue[]> {
  const { ruleset, state, used, remaining } = context
  const actor = state.players[submission.playerId]
  if (actor === undefined) return Result.Failure([{ path: [...path, "playerId"], message: "Unknown player" }])
  const action = ruleset.actions.get(submission.actionDefinitionId)
  if (action === undefined) return Result.Failure([{ path: [...path, "actionDefinitionId"], message: "Unknown action definition" }])
  const issues = [
    ...validateOpportunity(submission, ruleset, used, path),
    ...validateSelectedTargets(submission.selectedTargets, action, state, path),
    ...validateConstraints({ submission, action }, actor.id, state, path),
    ...reserveResources(actor, action, remaining, path),
  ]
  return issues.length > 0 ? Result.Failure(issues) : Result.Success({ submission, action })
}

function validateOpportunity(
  submission: SubmittedAction,
  ruleset: CompiledRuleset,
  used: Map<PlayerId, Set<string>>,
  path: readonly PropertyKey[],
): CompilationIssue[] {
  const issues: CompilationIssue[] = []
  const poolEntry = ruleset.definition.actionPool.find((entry) => entry.id === submission.id)
  if (poolEntry?.actionDefinitionId !== submission.actionDefinitionId)
    issues.push({ path: [...path, "id"], message: "Action is not available in the pool" })
  const actorUsed = used.get(submission.playerId) ?? new Set<string>()
  if (actorUsed.has(submission.id)) issues.push({ path: [...path, "id"], message: "Action opportunity already submitted" })
  actorUsed.add(submission.id)
  used.set(submission.playerId, actorUsed)
  return issues
}

function validateSelectedTargets(
  selected: Readonly<Record<string, string>>,
  action: CompiledAction,
  state: ExecutionState,
  path: readonly PropertyKey[],
): CompilationIssue[] {
  const issues: CompilationIssue[] = []
  for (const [name, kind] of Object.entries(action.definition.targets)) {
    const id = Object.hasOwn(selected, name) ? selected[name] : undefined
    if (id === undefined || findTarget(kind, id, state) === undefined) {
      issues.push({ path: [...path, "selectedTargets", name], message: `Missing or unknown ${kind} target` })
    }
  }
  issues.push(
    ...Object.keys(selected)
      .filter((name) => !Object.hasOwn(action.definition.targets, name))
      .map((name) => ({ path: [...path, "selectedTargets", name], message: "Unexpected target" })),
  )
  return issues
}

function validateConstraints(
  { submission, action }: ValidatedSubmission,
  actorId: PlayerId,
  state: ExecutionState,
  path: readonly PropertyKey[],
): CompilationIssue[] {
  return evaluateConstraints(action.constraints, submission.selectedTargets, actorId, state).flatMap((status, index) =>
    status === "satisfied" ? [] : [{ path: [...path, "constraints", index], message: `Constraint ${status}` }],
  )
}

function reserveResources(
  actor: ResolutionPlayer,
  action: CompiledAction,
  remaining: Map<PlayerId, Resources>,
  path: readonly PropertyKey[],
): CompilationIssue[] {
  const resources = remaining.get(actor.id) ?? { ...actor.resources }
  const spending = [...action.costs, ...action.mechanics].flatMap((invocation) => invocation.resourceSpending)
  for (const cost of spending) resources[cost.resourceType] -= cost.quantity
  remaining.set(actor.id, resources)
  return Object.entries(resources)
    .filter(([, quantity]) => quantity < 0)
    .map(([resource, quantity]) => ({ path: [...path, "costs", resource], message: `Missing ${-quantity} ${resource}` }))
}
