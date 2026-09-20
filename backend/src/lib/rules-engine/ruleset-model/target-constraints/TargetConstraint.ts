import { z } from "zod"
import { OwnedBySubmittingPlayerConstraintSchema } from "#lib/rules-engine/ruleset-model/target-constraints/implementations/OwnedBySubmittingPlayerConstraint.ts"

/**
 * The complete set of target constraints supported by this Rules Engine.
 */
export type TargetConstraint = z.infer<typeof TargetConstraintSchema>

/**
 * The constraint union used by Action target slots.
 */
export type ActionTargetConstraint = TargetConstraint

/**
 * The constraint union used by Mechanic target definitions.
 */
export type MechanicTargetConstraint = TargetConstraint

/**
 * The runtime parser for all target constraints.
 */
export const TargetConstraintSchema = z.discriminatedUnion("type", [OwnedBySubmittingPlayerConstraintSchema])

/**
 * The runtime parser used by Action target slots.
 */
export const ActionTargetConstraintSchema = TargetConstraintSchema satisfies z.ZodType<ActionTargetConstraint>

/**
 * The runtime parser used by Mechanic target definitions.
 */
export const MechanicTargetConstraintSchema = TargetConstraintSchema satisfies z.ZodType<MechanicTargetConstraint>
