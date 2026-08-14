import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"

export function createActionSubmissionStub(overrides: Partial<ActionSubmission> = {}): ActionSubmission {
  return {
    id: "action-submission-id",
    actionDefinitionId: "MAKE_MORE_MONEY",
    targets: {
      self: "player-id",
    },
    ...overrides,
  }
}
