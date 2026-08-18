import type { Result } from "@guillaume-docquier/tools-ts"
import type { DeepReadonly } from "utility-types"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset-model/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export type ActionSubmissionValidator = (
  actionSubmissions: readonly ActionSubmission[],
  ruleset: Ruleset,
  turnState: DeepReadonly<TurnState>,
) => Result<ActionSubmissionIssue[], string>
