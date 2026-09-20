import { z } from "zod"
import { TargetTypeSchema, type TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { TargetConstraintSchema, type TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

export type ActionTargetDefinition = Readonly<{
  targetType: TargetType
  constraints: readonly TargetConstraint[]
}>

export const ActionTargetDefinitionSchema = z.object({
  targetType: TargetTypeSchema,
  constraints: z.array(TargetConstraintSchema).readonly(),
}) satisfies z.ZodType<ActionTargetDefinition>
