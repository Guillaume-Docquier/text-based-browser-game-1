import { z } from "zod"
import { DifferentFromFleetOriginConstraintSchema } from "#shared/domain/ruleset/target-definitions/DifferentFromFleetOriginTargetConstraint.ts"
import { OwnedBySubmittingPlayerConstraintSchema } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"
import { StationaryFleetConstraintSchema } from "#shared/domain/ruleset/target-definitions/StationaryFleetTargetConstraint.ts"
import { WithinFleetRangeConstraintSchema } from "#shared/domain/ruleset/target-definitions/WithinFleetRangeTargetConstraint.ts"

export type TargetConstraint = z.infer<typeof TargetConstraintSchema>

export const TargetConstraintSchema = z.discriminatedUnion("type", [
  OwnedBySubmittingPlayerConstraintSchema,
  StationaryFleetConstraintSchema,
  WithinFleetRangeConstraintSchema,
  DifferentFromFleetOriginConstraintSchema,
])
