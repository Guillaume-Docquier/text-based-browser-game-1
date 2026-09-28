import type { SubmittedAction } from "game-rules/action-submission/Action.ts"
import type { ActionDefinitionId } from "game-rules/models/ActionDefinitionId.ts"

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
