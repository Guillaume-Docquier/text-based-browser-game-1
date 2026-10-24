import { Assert, Result, type Rng } from "@guillaume-docquier/tools-ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"
import type { CompilationIssue } from "../compiler/CompilationIssue.ts"
import {
  MechanicPhases,
  type CompiledRuleset,
  type CompiledInvocation,
  type MechanicOutcome,
  type MechanicPhase,
} from "../compiler/CompiledRuleset.ts"
import { evaluateConstraints } from "../constraints/evaluateConstraints.ts"
import type { ExecutionContext, ExecutionState } from "./ExecutionContext.ts"
import { validateSubmissions, type ValidatedSubmission } from "./validateSubmissions.ts"

export type ExecutionResult = Readonly<{
  state: ExecutionState
  outcomes: ReadonlyArray<Readonly<{ submission: SubmittedAction; outcomes: readonly MechanicOutcome[] }>>
}>
type SubmissionExecution = ValidatedSubmission & { outcomes: MechanicOutcome[] }
type TurnExecutionContext = Readonly<{ state: ExecutionState; rng: Rng }>

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
  const context = { state, rng: createRng() }
  const records: SubmissionExecution[] = validation.value.map((item) => ({ ...item, outcomes: [] }))
  for (const phase of MechanicPhases) {
    const result = executePhase(phase, records, context)
    if (Result.isFailure(result)) return result
  }
  return Result.Success({ state, outcomes: records.map(({ submission, outcomes }) => ({ submission, outcomes })) })
}

function executePhase(
  phase: MechanicPhase,
  records: readonly SubmissionExecution[],
  context: TurnExecutionContext,
): Result<void, CompilationIssue[]> {
  for (const record of records) {
    const result = executeSubmissionPhase(phase, record, context)
    if (Result.isFailure(result)) return result
  }
  return Result.Success(undefined)
}

function executeSubmissionPhase(
  phase: MechanicPhase,
  { submission, action, outcomes }: SubmissionExecution,
  { state, rng }: TurnExecutionContext,
): Result<void, CompilationIssue[]> {
  const actor = state.players[submission.playerId]
  Assert.isDefined(actor)
  const invocations = [...action.costs, ...action.mechanics].filter((invocation) => invocation.phase === phase)
  for (const invocation of invocations) {
    const result = executeInvocation(invocation, submission, { state, actor, rng })
    if (Result.isFailure(result)) return result
    outcomes.push(...result.value)
  }
  return Result.Success(undefined)
}

function executeInvocation(
  invocation: CompiledInvocation,
  submission: SubmittedAction,
  context: ExecutionContext,
): Result<readonly MechanicOutcome[], CompilationIssue[]> {
  // Requirements are rechecked at execution, after earlier phases changed state.
  const statuses = evaluateConstraints(invocation.requirements, submission.selectedTargets, context.actor.id, context.state)
  if (statuses.some((status) => status !== "satisfied")) {
    return Result.Success([{ status: "prevented", message: "Mechanic requirements no longer satisfied" }])
  }
  return invocation.execute(context, submission.selectedTargets)
}
