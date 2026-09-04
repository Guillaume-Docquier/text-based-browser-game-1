import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"

export function createSubmittedActionTargetsDtoStub({
  actionId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<SubmittedActionTargetsDto>> = {}): SubmittedActionTargetsDto {
  return {
    actionId: branded(actionId),
    targets: null,
    ...overrides,
  }
}
