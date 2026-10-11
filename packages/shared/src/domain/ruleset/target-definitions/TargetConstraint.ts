import { PositiveNumberSchema } from "@guillaume-docquier/tools-ts/schemas"
import { z } from "zod"
import { TargetTagSchema } from "#shared/domain/ruleset/action-definitions/TargetTag.ts"
import { OwnedBySubmittingPlayerConstraintSchema } from "#shared/domain/ruleset/target-definitions/OwnedBySubmittingPlayerTargetConstraint.ts"

export type TargetConstraint = z.infer<typeof TargetConstraintSchema>

export const TargetConstraintSchema = z.discriminatedUnion("type", [
  OwnedBySubmittingPlayerConstraintSchema,
  z.object({ type: z.literal("STATIONARY_FLEET") }),
  z.object({
    type: z.literal("WITHIN_FLEET_RANGE"),
    fleetTargetTag: TargetTagSchema,
    maximumDistance: z.number().pipe(PositiveNumberSchema),
  }),
])
