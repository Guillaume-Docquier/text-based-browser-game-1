import { createSubmittedActionStub } from "#shared/domain/actions/Action.stub.ts"
import { createEffectOutcomeStub } from "#shared/domain/actions/EffectOutcome.stub.ts"
import type { ResolvedAction } from "#shared/domain/actions/ResolvedAction.ts"

/**
 * Build a resolved action with one submitted action and one applied outcome by default.
 */
export function createResolvedActionStub({
  submittedAction = createSubmittedActionStub(),
  actionOutcomes = [createEffectOutcomeStub()],
  ...overrides
}: Partial<ResolvedAction> = {}): ResolvedAction {
  return {
    submittedAction,
    actionOutcomes,
    ...overrides,
  }
}
