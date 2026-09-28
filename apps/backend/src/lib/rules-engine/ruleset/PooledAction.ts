import { z } from "zod"
import { ActionIdSchema, type ActionId } from "#lib/db/actions/ActionId.ts"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#lib/db/rulesets/ActionDefinitionId.ts"

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
