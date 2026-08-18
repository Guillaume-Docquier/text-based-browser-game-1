import { v4 } from "uuid"
import type { ActionSubmission } from "#lib/rules-engine/action-submission/ActionSubmission.ts"

export function createActionSubmissionStub(overrides: Partial<ActionSubmission> = {}): ActionSubmission {
  const submittedByPlayerId = v4()

  return {
    id: v4(),
    submittedByPlayerId,
    actionDefinitionId: v4(),
    targets: {
      self: submittedByPlayerId,
    },
    ...overrides,
  }
}
