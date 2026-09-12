import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type TargetType = Enumify<typeof TargetType>
export const TargetType = {
  FLEET: "FLEET",
  PLANET: "PLANET",
  /**
   * A planet owned by the player who submitted the action.
   */
  PLANET_OWNED: "PLANET_OWNED",
  PLAYER: "PLAYER",
} as const

export const TargetTypeSchema = z.enum(TargetType) satisfies z.ZodType<TargetType>

export function targetTypeSatisfies(targetType: TargetType, requiredTargetType: TargetType): boolean {
  return targetType === requiredTargetType || (targetType === TargetType.PLANET_OWNED && requiredTargetType === TargetType.PLANET)
}
