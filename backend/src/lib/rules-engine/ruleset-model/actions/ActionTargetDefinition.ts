import { z } from "zod"
import { TargetTypeSchema, type TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import { OwnedBySubmittingPlayerConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"
import { TargetConstraintSchema, type TargetConstraint } from "#lib/rules-engine/ruleset-model/target-constraints/TargetConstraint.ts"

export type ActionTargetDefinition = Readonly<{
  targetType: TargetType
  constraints: readonly TargetConstraint[]
}>

const supportedTargetTypesByConstraintType = {
  [OwnedBySubmittingPlayerConstraint.type]: OwnedBySubmittingPlayerConstraint.supportedTargetTypes,
} satisfies Record<TargetConstraint["type"], readonly TargetType[]>

export const ActionTargetDefinitionSchema = z
  .object({
    targetType: TargetTypeSchema,
    constraints: z.array(TargetConstraintSchema).readonly(),
  })
  .superRefine(({ targetType, constraints }, context) => {
    for (const [index, constraint] of constraints.entries()) {
      const supportsTargetType = supportedTargetTypesByConstraintType[constraint.type].some(
        (supportedTargetType) => supportedTargetType === targetType,
      )
      if (!supportsTargetType) {
        context.addIssue({
          code: "custom",
          path: ["constraints", index],
          message: `Constraint "${constraint.type}" does not support target type "${targetType}"`,
        })
      }
    }
  }) satisfies z.ZodType<ActionTargetDefinition>
