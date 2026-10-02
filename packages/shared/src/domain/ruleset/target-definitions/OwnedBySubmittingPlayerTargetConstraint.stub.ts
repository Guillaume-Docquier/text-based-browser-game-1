import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"

/**
 * Build the ownership constraint used by most player-owned target tests.
 */
export function createOwnedBySubmittingPlayerTargetConstraintStub(): OwnedBySubmittingPlayerConstraint {
  return OwnedBySubmittingPlayerConstraint.create()
}
