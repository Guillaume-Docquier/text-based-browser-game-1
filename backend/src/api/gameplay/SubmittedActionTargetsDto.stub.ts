import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"

export function createSubmittedActionTargetsDtoStub(overrides?: Partial<SubmittedActionTargetsDto>): SubmittedActionTargetsDto {
  return {
    actionId: v4(),
    targets: null,
    ...overrides,
  }
}
