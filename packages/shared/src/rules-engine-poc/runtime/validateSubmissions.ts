import { Result } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import type { CompiledAction, CompiledRuleset } from "../compiler/CompiledRuleset.ts"
import { evaluateConstraints } from "../constraints/evaluateConstraints.ts"
import type { ExecutionState } from "./ExecutionContext.ts"
import { findTarget } from "./resolveTargets.ts"

export type ValidatedSubmission = Readonly<{ submission: SubmittedAction; action: CompiledAction }>

/**
 * Checks pool membership, once-per-player opportunities, concrete targets and
 * combined spending. Same-turn gains cannot finance costs paid before Income.
 */
export function validateSubmissions(
  submissions: readonly SubmittedAction[],
  ruleset: CompiledRuleset,
  state: ExecutionState,
): Result<readonly ValidatedSubmission[], CompilationIssue[]> {
  const issues: CompilationIssue[] = []
  const validated: ValidatedSubmission[] = []
  const remaining = new Map<PlayerId, Resources>()
  const used = new Map<PlayerId, Set<string>>()
  for (const [index, submission] of submissions.entries()) {
    const path = ["submissions", index]
    const selected: Readonly<Record<string, string>> = submission.selectedTargets
    const actor = state.players[submission.playerId]
    const action = ruleset.actions.get(submission.actionDefinitionId)
    if (actor === undefined) {
      issues.push({ path: [...path, "playerId"], message: "Unknown player" })
      continue
    }
    if (action === undefined) {
      issues.push({ path: [...path, "actionDefinitionId"], message: "Unknown action definition" })
      continue
    }
    const poolEntry = ruleset.definition.actionPool.find((entry) => entry.id === submission.id)
    if (poolEntry?.actionDefinitionId !== submission.actionDefinitionId)
      issues.push({ path: [...path, "id"], message: "Action is not available in the pool" })
    const actorUsed = used.get(submission.playerId) ?? new Set<string>()
    if (actorUsed.has(submission.id)) issues.push({ path: [...path, "id"], message: "Action opportunity already submitted" })
    actorUsed.add(submission.id)
    used.set(submission.playerId, actorUsed)
    for (const [name, kind] of Object.entries(action.definition.targets)) {
      const id = Object.hasOwn(selected, name) ? selected[name] : undefined
      if (id === undefined || findTarget(kind, id, state) === undefined) {
        issues.push({ path: [...path, "selectedTargets", name], message: `Missing or unknown ${kind} target` })
      }
    }
    for (const name of Object.keys(submission.selectedTargets)) {
      if (!Object.hasOwn(action.definition.targets, name))
        issues.push({ path: [...path, "selectedTargets", name], message: "Unexpected target" })
    }
    evaluateConstraints(action.constraints, submission.selectedTargets, actor.id, state).forEach((status, constraintIndex) => {
      if (status !== "satisfied") issues.push({ path: [...path, "constraints", constraintIndex], message: `Constraint ${status}` })
    })
    const resources = remaining.get(actor.id) ?? { ...actor.resources }
    for (const invocation of [...action.costs, ...action.mechanics]) {
      for (const cost of invocation.resourceSpending) {
        resources[cost.resourceType] -= cost.quantity
      }
    }
    for (const [resource, quantity] of Object.entries(resources)) {
      if (quantity < 0) issues.push({ path: [...path, "costs", resource], message: `Missing ${-quantity} ${resource}` })
    }
    remaining.set(actor.id, resources)
    validated.push({ submission, action })
  }
  return issues.length > 0 ? Result.Failure(issues) : Result.Success(validated)
}
