import { z } from "zod"
import { OwnedBySubmittingPlayerConstraintSchema } from "#game-rules/ruleset/target-definitions/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

export type TargetConstraint = z.infer<typeof TargetConstraintSchema>

export const TargetConstraintSchema = z.discriminatedUnion("type", [OwnedBySubmittingPlayerConstraintSchema])
