import type { Enumify } from "@guillaume-docquier/tools-ts"

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
