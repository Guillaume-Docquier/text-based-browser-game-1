import { ActionDefinitionIdSchema, type ActionDefinitionId } from "game-rules/models/ActionDefinitionId.ts"
import { ActionIdSchema, type ActionId } from "game-rules/models/ActionId.ts"
import { z } from "zod"

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
