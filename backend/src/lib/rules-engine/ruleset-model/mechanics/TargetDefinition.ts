import { z } from "zod"
import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import {
  MechanicTargetConstraintSchema,
  type MechanicTargetConstraint,
} from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

export type { MechanicTargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

export type TargetDefinition<TTargetType extends TargetType = TargetType> = Readonly<{
  /**
   * The key to use on the submitted action's selected targets to find the target id.
   * This is not the id of the actual target.
   */
  tag: string
  /**
   * The type that this target must be.
   */
  type: TTargetType
  /**
   * Constraints that every target selected for this mechanic must satisfy.
   */
  constraints: readonly MechanicTargetConstraint[]
}>

export function TargetDefinitionSchema<TTargetType extends TargetType>(
  targetTypeSchema: z.ZodType<TTargetType>,
): z.ZodType<TargetDefinition<TTargetType>> {
  return z.object({
    tag: z.string(),
    type: targetTypeSchema,
    constraints: z.array(MechanicTargetConstraintSchema).readonly(),
  }) satisfies z.ZodType<TargetDefinition<TTargetType>>
}
