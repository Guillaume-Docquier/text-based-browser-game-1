import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"
import { ActionIdSchema, type ActionId } from "#shared/domain/turns/actions/ActionId.ts"

/**
 * A stable Action in a Ruleset's Action Pool.
 */
export type PooledAction = Readonly<{
  id: ActionId
  actionDefinitionId: ActionDefinitionId
}>

export const PooledActionSchema = z.object({
  id: ActionIdSchema,
  actionDefinitionId: ActionDefinitionIdSchema,
}) satisfies z.ZodType<PooledAction>
