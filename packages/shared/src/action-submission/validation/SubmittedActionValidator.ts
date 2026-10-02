import type { Result } from "@guillaume-docquier/tools-ts"
import type { ReadonlyDeep } from "type-fest"
import type { SubmittedActionIssue } from "#shared/action-submission/validation/SubmittedActionIssue.ts"
import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type SubmittedActionValidator = (
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: ReadonlyDeep<TurnState>,
) => Result<SubmittedActionIssue[], string>
