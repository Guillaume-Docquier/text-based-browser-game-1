import type { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { SubmittedActionIssue } from "#game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { CompiledRuleset } from "#game-rules/ruleset/CompiledRuleset.ts"
import type { TurnState } from "#game-rules/turn-resolution/TurnState.ts"

export type SubmittedActionValidator = (
  submittedActions: readonly SubmittedAction[],
  ruleset: CompiledRuleset,
  turnState: ReadonlyDeep<TurnState>,
) => Result<SubmittedActionIssue[], string>
