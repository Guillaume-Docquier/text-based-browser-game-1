import { z } from "zod"
import { PlanetOwnedBySubmittingPlayerConstraintSchema } from "#shared/domain/ruleset/target-definitions/planet/PlanetOwnedBySubmittingPlayerConstraint.ts"

/**
 * Constraints supported by planet target slots.
 */
export type PlanetTargetConstraint = z.infer<typeof PlanetTargetConstraintSchema>

export const PlanetTargetConstraintSchema = z.discriminatedUnion("type", [PlanetOwnedBySubmittingPlayerConstraintSchema])
