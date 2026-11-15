import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { v4 } from "uuid"
import type { SubmittedActionTargets } from "#api/gameplay/SubmittedActionTargets.ts"

export function createSubmittedActionTargetsStub({
  actionId = v4(),
  selectedTargets = null,
  ...overrides
}: Partial<
  UnbrandedProperties<Omit<SubmittedActionTargets, "selectedTargets">> & DeepUnbranded<Pick<SubmittedActionTargets, "selectedTargets">>
> = {}): SubmittedActionTargets {
  return {
    actionId: branded(actionId),
    selectedTargets: selectedTargets === null ? null : typedParse(SelectedTargetsSchema, selectedTargets),
    ...overrides,
  }
}
