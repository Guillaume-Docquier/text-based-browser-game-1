import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import type { SelectedTargets } from "#shared/domain/actions/SelectedTargets.ts"
import { SelectedTargetsSchema } from "#shared/domain/actions/SelectedTargets.ts"

/**
 * Build selected action targets from unbranded string ids.
 */
export function createSelectedTargetsStub(overrides: Readonly<Record<string, string>> = {}): SelectedTargets {
  return typedParse(SelectedTargetsSchema, overrides)
}
