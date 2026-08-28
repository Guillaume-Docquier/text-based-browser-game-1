import type { SubmittedAction } from "#lib/rules-engine/action-submission/Action.ts"

export type SubmittedActionIssue = Readonly<{
  issue: string
  submittedActionId: string
  actionDefinitionId: string
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
