import type { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedAction } from "#game-rules/action-submission/Action.ts"
import type { SubmittedActionIssue } from "#game-rules/action-submission/validation/SubmittedActionIssue.ts"
import type { Ruleset } from "#game-rules/ruleset/Ruleset.ts"
import type { TurnState } from "#game-rules/turn-resolution/TurnState.ts"

export type SubmittedActionValidator = (
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
) => Result<SubmittedActionIssue[], string>
