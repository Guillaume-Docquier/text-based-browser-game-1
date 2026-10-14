import { z } from "zod"

/**
 * A positive whole-number input that the player supplies when submitting an Action.
 */
export type ActionInputDefinition = Readonly<{
  type: "POSITIVE_INTEGER"
  label: string
}>

export const ActionInputDefinitionSchema = z.object({
  type: z.literal("POSITIVE_INTEGER"),
  label: z.string(),
}) satisfies z.ZodType<ActionInputDefinition>
