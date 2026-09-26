import { z } from "zod"
import type { TargetType } from "#lib/rules-engine/ruleset/mechanics/TargetType.ts"

export type MechanicTargetDefinition<TTargetType extends TargetType = TargetType> = {
  /**
   * The tag to use to resolve this target on the action's submitted targets.
   *
   * The tag is how the target is resolved from the action.
   * A {@link TargetRole} is how the mechanic talks about a target internally.
   *
   * For example, an action might say "fleet 1 gains 1 strength and fleet 2 gains 2 strength"
   *
   * The action will have 2 target slots: "fleet 1" and "fleet 2"
   * The GainStrength mechanic will have 1 target role: "fleet"
   * The action will have 2 mechanics:
   * - GainStrength with actionTargetTag "fleet 1" for target role "fleet" and strength 1
   * - GainStrength with actionTargetTag "fleet 2" for target role "fleet" and strength 2
   *
   * In other words, the role declares what the mechanic needs, the tag declares where on the action that target id will be.
   */
  actionTargetTag: string
  /**
   * The type that this target must be.
   */
  targetType: TTargetType
}

export function MechanicTargetDefinitionSchema<TTargetType extends TargetType>(
  targetTypeSchema: z.ZodType<TTargetType>,
): z.ZodType<MechanicTargetDefinition<TTargetType>> {
  return z.object({
    actionTargetTag: z.string(),
    targetType: targetTypeSchema,
  })
}
