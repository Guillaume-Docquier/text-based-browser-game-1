import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"

export type ActionSubmissionIssue = { issue: string }

export const ActionSubmissionIssue = {
  create: ({
    cause,
    actionSubmission,
    actionDefinitionName,
  }: {
    cause: string
    /**
     * Metadata included in the issue description.
     */
    actionSubmission: ActionSubmission
    /**
     * Metadata included in the issue description.
     */
    actionDefinitionName: string | undefined
  }): ActionSubmissionIssue => {
    const actionDefinitionDescription =
      actionDefinitionName === undefined
        ? actionSubmission.actionDefinitionId
        : `${actionSubmission.actionDefinitionId} (${actionDefinitionName})`

    return {
      issue: `Action Submission ${actionSubmission.id} for Action Definition ${actionDefinitionDescription}: ${cause}.`,
    }
  },
}
