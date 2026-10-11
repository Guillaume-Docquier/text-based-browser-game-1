import { z } from "zod"
import { OwnedBySubmittingPlayerConstraint } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraint } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { TargetConstraintSchema, type TargetConstraint } from "#shared/domain/ruleset/target-definitions/TargetConstraint.ts"
import { TargetType, TargetTypeSchema, type TargetType as TargetTypeValue } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

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

const supportedTargetTypes: Record<TargetConstraint["type"], ReadonlySet<TargetTypeValue>> = {
  [OwnedBySubmittingPlayerConstraint.type]: OwnedBySubmittingPlayerConstraint.supportedTargetTypes,
  [StationaryFleetConstraint.type]: StationaryFleetConstraint.supportedTargetTypes,
  WITHIN_FLEET_RANGE: new Set([TargetType.PLANET]),
  DIFFERENT_FROM_FLEET_ORIGIN: new Set([TargetType.PLANET]),
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
