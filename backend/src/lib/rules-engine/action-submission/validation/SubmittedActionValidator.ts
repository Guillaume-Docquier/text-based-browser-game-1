import type { Result } from "@guillaume-docquier/tools-ts"
import type { DeepReadonly } from "utility-types"
import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"
import type { SubmittedActionIssue } from "#lib/rules-engine/action-submission/validation/SubmittedActionIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export type SubmittedActionValidator = (
  submittedActions: readonly SubmittedAction[],
  ruleset: Ruleset,
  turnState: DeepReadonly<TurnState>,
) => Result<SubmittedActionIssue[], string>
