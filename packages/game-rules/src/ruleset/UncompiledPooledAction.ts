import { z } from "zod"
import { ActionDefinitionIdSchema, type ActionDefinitionId } from "#game-rules/models/ActionDefinitionId.ts"

/** An authored Action Pool entry. The compiler assigns its stable Action ID. */
export type UncompiledPooledAction = Readonly<{
  actionDefinitionId: ActionDefinitionId
}>

export const UncompiledPooledActionSchema = z.object({
  actionDefinitionId: ActionDefinitionIdSchema,
}) satisfies z.ZodType<UncompiledPooledAction>
