import { z } from "zod"
import { TargetTypeSchema, type TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { TargetConstraintSchema, type TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

export type { TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

/**
 * The target slot definition exposed by an Action Definition.
 */
export type ActionTargetDefinition = Readonly<{
  type: TargetType
  constraints: readonly TargetConstraint[]
}>

/**
 * The runtime parser for Action target slot definitions.
 */
export const ActionTargetDefinitionSchema = z.object({
  type: TargetTypeSchema,
  constraints: z.array(TargetConstraintSchema).readonly(),
}) satisfies z.ZodType<ActionTargetDefinition>
