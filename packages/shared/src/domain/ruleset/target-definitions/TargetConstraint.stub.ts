import { createOwnedBySubmittingPlayerTargetConstraintStub } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.stub.ts"
import type { TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"

/**
 * Build the default supported target constraint for tests.
 */
export function createTargetConstraintStub(): TargetConstraint {
  return createOwnedBySubmittingPlayerTargetConstraintStub()
}
