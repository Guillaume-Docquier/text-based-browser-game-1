import { z } from "zod"
import { OwnedBySubmittingPlayerConstraintSchema } from "#lib/rules-engine/ruleset/target-constraints/implementations/OwnedBySubmittingPlayerTargetConstraint.ts"

export type TargetConstraint = z.infer<typeof TargetConstraintSchema>

export const TargetConstraintSchema = z.discriminatedUnion("type", [OwnedBySubmittingPlayerConstraintSchema])
