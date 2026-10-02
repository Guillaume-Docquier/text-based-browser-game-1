import { typedParse } from "@guillaume-docquier/tools-ts/schemas"
import { v4 } from "uuid"
import type { PooledAction } from "#shared/domain/ruleset/PooledAction.ts"
import { PooledActionSchema } from "#shared/domain/ruleset/PooledAction.ts"

/**
 * Build a valid pooled action with unique test ids by default.
 */
export function createPooledActionStub({
  id = v4(),
  actionDefinitionId = v4(),
}: Partial<{ id: string; actionDefinitionId: string }> = {}): PooledAction {
  return typedParse(PooledActionSchema, { id, actionDefinitionId })
}
