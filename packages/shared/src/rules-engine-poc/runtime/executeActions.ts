import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import { MechanicPhases, type CompiledRuleset, type CompiledAction, type MechanicOutcome } from "../compiler/CompiledRuleset.ts"
import { evaluateConstraints } from "../constraints/evaluateConstraints.ts"
import type { ExecutionState } from "./ExecutionContext.ts"
import { validateSubmissions, type ValidatedSubmission } from "./validateSubmissions.ts"

export type ExecutionResult = Readonly<{
  state: ExecutionState
  outcomes: ReadonlyArray<Readonly<{ submission: SubmittedAction; outcomes: readonly MechanicOutcome[] }>>
}>

/**
 * Runs engine-owned phases on a copy. A failed mechanic discards partial state.
 * The supplied RNG factory creates a fresh sequence for each attempt.
 */
export function executeActions(
  ruleset: CompiledRuleset,
  inputState: ExecutionState,
  submissions: readonly SubmittedAction[],
  createRng: () => Rng,
): Result<ExecutionResult, CompilationIssue[]> {
  const validation = validateSubmissions(submissions, ruleset, inputState)
  if (Result.isFailure(validation)) return validation
  const state = structuredClone(inputState)
  const rng = createRng()
  const outcomes: Array<{ submission: SubmittedAction; outcomes: MechanicOutcome[] }> = validation.value.map(({ submission }) => ({
    submission,
    outcomes: [],
  }))
  for (const phase of MechanicPhases) {
    for (let index = 0; index < validation.value.length; index++) {
      const item: ValidatedSubmission | undefined = validation.value[index]
      Assert.isDefined(item)
      const submission: SubmittedAction = item.submission
      const action: CompiledAction = item.action
      const actor = state.players[submission.playerId]
      Assert.isDefined(actor)
      const record = outcomes[index]
      Assert.isDefined(record)
      for (const invocation of [...action.costs, ...action.mechanics]) {
        if (invocation.phase !== phase) continue
        // Requirements are rechecked at execution, after earlier phases changed state.
        const statuses = evaluateConstraints(invocation.requirements, submission.selectedTargets, actor.id, state)
        if (statuses.some((status) => status !== "satisfied")) {
          record.outcomes.push({ status: "prevented", message: "Mechanic requirements no longer satisfied" })
          continue
        }
        const result = invocation.execute({ state, actor, rng }, submission.selectedTargets)
        if (Result.isFailure(result)) return result
        record.outcomes.push(...result.value)
      }
    }
  }
  return Result.Success({ state, outcomes })
}
