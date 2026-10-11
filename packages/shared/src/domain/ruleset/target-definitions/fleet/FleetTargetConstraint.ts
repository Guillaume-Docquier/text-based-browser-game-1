import { z } from "zod"
import { FleetOwnedBySubmittingPlayerConstraintSchema } from "#shared/domain/ruleset/target-definitions/fleet/FleetOwnedBySubmittingPlayerConstraint.ts"

/**
 * Constraints supported by fleet target slots.
 */
export type FleetTargetConstraint = z.infer<typeof FleetTargetConstraintSchema>

export const FleetTargetConstraintSchema = z.discriminatedUnion("type", [FleetOwnedBySubmittingPlayerConstraintSchema])
