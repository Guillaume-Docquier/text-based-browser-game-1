import type { ActionValidationIssue } from "#shared/action-submission/validation/ActionValidationIssue.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import type { SubmittedAction } from "#shared/domain/turns/actions/Action.ts"

export type SubmittedActionIssue = Readonly<{
  issue: ActionValidationIssue
  submittedActionId: string
  actionDefinitionId: ActionDefinitionId
  actionDefinitionName: string | undefined
}>

export const SubmittedActionIssue = {
  create: ({
    issue,
    submittedAction,
    actionDefinitionName,
  }: {
    issue: ActionValidationIssue
    submittedAction: SubmittedAction
    actionDefinitionName: string | undefined
  }): SubmittedActionIssue => {
    return {
      issue,
      submittedActionId: submittedAction.id,
      actionDefinitionId: submittedAction.actionDefinitionId,
      actionDefinitionName,
    }
  },
}
