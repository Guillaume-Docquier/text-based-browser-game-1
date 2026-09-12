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

/**
 *
 * Primitive for now, we'll see how it evolves.
 *
 * provided is the target type we're trying to submit
 * required is the target type that's required by the submission
 */
export function targetTypeSatisfies({ provided, required }: { provided: TargetType; required: TargetType }): boolean {
  if (provided === required) {
    return true
  }

  // TargetType.PLANET_OWNED can be used when PLANET is required, because PLANET_OWNED is a PLANET
  return provided === TargetType.PLANET_OWNED && required === TargetType.PLANET
}
