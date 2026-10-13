import { branded, type DeepUnbranded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { SelectedTargetsSchema } from "shared/domain/turns/actions/SelectedTargets.ts"
import { v4 } from "uuid"
import { SubmittedActionTargetsDtoSchema, type SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"

export function createSubmittedActionTargetsDtoStub({
  actionId = v4(),
  selectedTargets = null,
  selectedInputs = selectedTargets === null ? null : {},
  ...overrides
}: Partial<
  UnbrandedProperties<Omit<SubmittedActionTargetsDto, "selectedTargets" | "selectedInputs">> &
    DeepUnbranded<Pick<SubmittedActionTargetsDto, "selectedTargets" | "selectedInputs">>
> = {}): SubmittedActionTargetsDto {
  return SubmittedActionTargetsDtoSchema.parse({
    actionId: branded(actionId),
    selectedTargets: selectedTargets === null ? null : typedParse(SelectedTargetsSchema, selectedTargets),
    selectedInputs,
    ...overrides,
  })
}
