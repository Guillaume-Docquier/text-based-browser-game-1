import { branded } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import type { z } from "zod"
import type { SubmittedActionTargetsDto } from "#api/gameplay/SubmittedActionTargetsDto.ts"
import type { ActionId } from "#lib/rules-engine/action-submission/Action.ts"

export function createSubmittedActionTargetsDtoStub({
  actionId,
  ...overrides
  // z.input to avoid requiring a branded actionId to be provided to the stub
}: Partial<z.input<typeof SubmittedActionTargetsDto>> = {}): SubmittedActionTargetsDto {
  return {
    actionId: branded<ActionId>(actionId ?? v4()),
    targets: null,
    ...overrides,
  }
}
