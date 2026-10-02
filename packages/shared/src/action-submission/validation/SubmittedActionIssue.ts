import type { SubmittedAction } from "#shared/domain/actions/Action.ts"
import type { ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"

export type SubmittedActionIssue = Readonly<{
  issue: string
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
    issue: string
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
