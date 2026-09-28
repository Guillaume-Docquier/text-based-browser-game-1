import { z } from "zod"
import { TargetTypeSchema, type TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetConstraintSchema, type TargetConstraint } from "#game-rules/ruleset/target-definitions/TargetConstraint.ts"

export type TargetDefinition = Readonly<{
  targetType: TargetType
  constraints: readonly TargetConstraint[]
}>

export const TargetDefinitionSchema = z
  .object({
    targetType: TargetTypeSchema,
    constraints: z.array(TargetConstraintSchema).readonly(),
  })
  .superRefine(validateConstraintsSupportTargetType) satisfies z.ZodType<TargetDefinition>

const supportedTargetTypes: Record<TargetConstraint["type"], ReadonlySet<TargetType>> = {
  [OwnedBySubmittingPlayerConstraint.type]: OwnedBySubmittingPlayerConstraint.supportedTargetTypes,
}

function validateConstraintsSupportTargetType({ targetType, constraints }: TargetDefinition, context: z.RefinementCtx): void {
  for (const [index, constraint] of constraints.entries()) {
    if (!supportedTargetTypes[constraint.type].has(targetType)) {
      context.addIssue({
        code: "custom",
        path: ["constraints", index],
        message: `Constraint "${constraint.type}" does not support target type "${targetType}"`,
      })
    }
  }
}
