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
  // SELF: "SELF", // A special target type always defined with the "self" tag. See TargetDefinition.ts
} as const

export const TargetTypeSchema = z.enum(TargetType)
