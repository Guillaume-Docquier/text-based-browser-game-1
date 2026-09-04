import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"

export function createSubmittedActionTargetsDtoStub({
  actionId,
  ...overrides
}: Partial<UnbrandedProperties<SubmittedActionTargetsDto>> = {}): SubmittedActionTargetsDto {
  return {
    actionId: branded(actionId ?? v4()),
    targets: null,
    ...overrides,
  }
}
