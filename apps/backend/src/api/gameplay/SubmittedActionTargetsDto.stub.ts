import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"

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
