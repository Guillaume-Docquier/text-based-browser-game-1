import { createSubmittedActionStub } from "#shared/domain/turns/actions/Action.stub.ts"
import type { ResolvedAction } from "#shared/domain/turns/actions/ResolvedAction.ts"

export function createResolvedActionStub({
  submittedAction = createSubmittedActionStub(),
  actionOutcomes = [],
  ...overrides
}: Partial<ResolvedAction> = {}): ResolvedAction {
  return {
    submittedAction,
    actionOutcomes,
    ...overrides,
  }
}
