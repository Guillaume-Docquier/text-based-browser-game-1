import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type TargetType = Enumify<typeof TargetType>
export const TargetType = {
  FLEET: "FLEET",
  PLANET: "PLANET",
  PLAYER: "PLAYER",
} as const

export const TargetTypeSchema = z.enum(TargetType) satisfies z.ZodType<TargetType>

export type TargetCondition = Enumify<typeof TargetCondition>
export const TargetCondition = {
  /**
   * The target is owned by the player who submitted the action.
   */
  OWNED: "OWNED",
} as const

export const TargetConditionSchema = z.enum(TargetCondition) satisfies z.ZodType<TargetCondition>
export const TargetConditionsSchema = z.array(TargetConditionSchema).readonly()

/**
 * The entity type and conditions accepted by a target slot.
 */
export type TargetRequirement =
  | Readonly<{
      type: typeof TargetType.FLEET
      conditions: readonly TargetCondition[]
    }>
  | Readonly<{
      type: typeof TargetType.PLANET
      conditions: readonly TargetCondition[]
    }>
  | Readonly<{
      type: typeof TargetType.PLAYER
      conditions: readonly never[]
    }>

export const TargetRequirementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(TargetType.FLEET),
    conditions: TargetConditionsSchema,
  }),
  z.object({
    type: z.literal(TargetType.PLANET),
    conditions: TargetConditionsSchema,
  }),
  z.object({
    type: z.literal(TargetType.PLAYER),
    conditions: z.array(z.never()).readonly(),
  }),
]) satisfies z.ZodType<TargetRequirement>

/**
 * Reports whether the provided target requirement is at least as restrictive as the required one.
 */
export function targetRequirementSatisfies({ provided, required }: { provided: TargetRequirement; required: TargetRequirement }): boolean {
  const providedConditions: readonly TargetCondition[] = provided.conditions
  const requiredConditions: readonly TargetCondition[] = required.conditions
  return provided.type === required.type && requiredConditions.every((condition) => providedConditions.includes(condition))
}
