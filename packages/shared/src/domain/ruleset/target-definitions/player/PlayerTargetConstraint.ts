import { z } from "zod"

/**
 * Player targets currently support no constraints.
 */
export type PlayerTargetConstraint = never

export const PlayerTargetConstraintSchema = z.never() satisfies z.ZodType<PlayerTargetConstraint>
