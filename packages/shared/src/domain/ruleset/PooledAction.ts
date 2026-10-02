import { z } from "zod"
import { ActionIdSchema, type ActionId } from "#shared/domain/actions/ActionId.ts"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#shared/domain/ruleset/action-definitions/ActionDefinitionId.ts"

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
