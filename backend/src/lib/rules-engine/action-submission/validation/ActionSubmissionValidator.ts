import type { Result } from "@guillaume-docquier/tools-ts"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"
import type { ActionSubmissionValidationIssue } from "#lib/rules-engine/action-submission/validation/ActionSubmissionValidationIssue.ts"
import type { Ruleset } from "#lib/rules-engine/ruleset/Ruleset.ts"
import type { TurnState } from "#lib/rules-engine/turn-resolution/TurnState.ts"

export type ActionSubmissionValidator = (
  actionSubmission: ActionSubmission,
  ruleset: Ruleset,
  turnState: Readonly<TurnState>,
) => Result<ActionSubmissionValidationIssue[], string>
