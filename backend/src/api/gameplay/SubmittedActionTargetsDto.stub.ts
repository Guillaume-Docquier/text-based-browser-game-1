import { v4 } from "uuid"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import { ActionId } from "#lib/rules-engine/action-submission/Action.ts"

export function createSubmittedActionTargetsDtoStub(overrides?: Partial<SubmittedActionTargetsDto>): SubmittedActionTargetsDto {
  return {
    actionId: ActionId.parse(v4()),
    targets: null,
    ...overrides,
  }
}
