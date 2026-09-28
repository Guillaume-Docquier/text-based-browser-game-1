import { type TargetTag, TargetTagSchema } from "game-rules/ruleset/action-definitions/TargetTag.ts"
import type { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import { z } from "zod"

export type EffectDefinitionTargetDefinition<TTargetType extends TargetType = TargetType> = {
  /**
   * The Action Definition target slot's tag, used to look up this target in the Action Submission.
   *
   * The tag is how the target is resolved from the action.
   * A {@link TargetRole} is how the effect definition talks about a target internally.
   *
   * For example, an action might say "fleet 1 gains 1 strength and fleet 2 gains 2 strength"
   *
   * The Action Definition will have 2 target slots, tagged "fleet 1" and "fleet 2".
   * The GainStrength effect definition will have 1 target role: "fleet"
   * The action will have 2 effects:
   * - GainStrength with actionTargetTag "fleet 1" for target role "fleet" and strength 1
   * - GainStrength with actionTargetTag "fleet 2" for target role "fleet" and strength 2
   *
   * In other words, the role declares what the effect definition needs, the tag declares where on the action that target id will be.
   */
  actionTargetTag: TargetTag
  /**
   * The type that this target must be.
   */
  targetType: TTargetType
}

export function EffectDefinitionTargetDefinitionSchema<TTargetType extends TargetType>(
  targetTypeSchema: z.ZodType<TTargetType>,
): z.ZodType<EffectDefinitionTargetDefinition<TTargetType>> {
  return z.object({
    actionTargetTag: TargetTagSchema,
    targetType: targetTypeSchema,
  })
}
