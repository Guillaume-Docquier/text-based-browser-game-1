import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"

export type ActionSubmissionIssue = Readonly<{
  issue: string
  actionSubmissionId: string
  actionDefinitionId: string
  actionDefinitionName: string | undefined
}>

export const ActionSubmissionIssue = {
  create: ({
    issue,
    actionSubmission,
    actionDefinitionName,
  }: {
    issue: string
    actionSubmission: ActionSubmission
    actionDefinitionName: string | undefined
  }): ActionSubmissionIssue => {
    return {
      issue,
      actionSubmissionId: actionSubmission.id,
      actionDefinitionId: actionSubmission.actionDefinitionId,
      actionDefinitionName,
    }
  },
}
