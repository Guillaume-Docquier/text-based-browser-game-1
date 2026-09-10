import { z } from "zod"
import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

export type TargetDefinition<TTargetType extends TargetType = TargetType> = {
  /**
   * The key to use on the submitted action's targets to find the target id.
   * This is not the id of the actual target.
   */
  tag: string
  /**
   * The type that this target must be.
   */
  type: TTargetType
}

export function TargetDefinitionSchema<TTargetType extends TargetType>(
  targetTypeSchema: z.ZodType<TTargetType>,
): z.ZodType<TargetDefinition<TTargetType>> {
  return z.object({
    tag: z.string(),
    type: targetTypeSchema,
  })
}
