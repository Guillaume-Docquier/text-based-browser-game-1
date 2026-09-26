import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import { SelectedTargetsSchema } from "#lib/rules-engine/action-submission/SelectedTargets.ts"
import { typedParse } from "#lib/validation/typedParse.ts"

export function createSubmittedActionTargetsDtoStub({
  actionId = v4(),
  selectedTargets = null,
  ...overrides
}: Partial<
  UnbrandedProperties<Omit<SubmittedActionTargetsDto, "selectedTargets">> &
    DeepUnbranded<Pick<SubmittedActionTargetsDto, "selectedTargets">>
> = {}): SubmittedActionTargetsDto {
  return {
    actionId: branded(actionId),
    selectedTargets: selectedTargets === null ? null : typedParse(SelectedTargetsSchema, selectedTargets),
    ...overrides,
  }
}
