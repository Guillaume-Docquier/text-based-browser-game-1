import { z } from "zod"
import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

export type MechanicTargetDefinition<TTargetType extends TargetType = TargetType> = {
  /**
   * The key to use on the submitted action's selected targets to find the target id.
   * This is not the id of the actual target.
   */
  tag: string
  /**
   * The type that this target must be.
   */
  targetType: TTargetType
}

export function MechanicTargetDefinitionSchema<TTargetType extends TargetType>(
  targetTypeSchema: z.ZodType<TTargetType>,
): z.ZodType<MechanicTargetDefinition<TTargetType>> {
  return z.object({
    tag: z.string(),
    targetType: targetTypeSchema,
  })
}
