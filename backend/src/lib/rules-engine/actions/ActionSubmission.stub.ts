import { v4 } from "uuid"
import type { ActionSubmission } from "#lib/rules-engine/actions/ActionSubmission.ts"

export function createActionSubmissionStub(overrides: Partial<ActionSubmission> = {}): ActionSubmission {
  return {
    id: v4(),
    actionDefinitionId: v4(),
    targets: {
      self: v4(),
    },
    ...overrides,
  }
}
