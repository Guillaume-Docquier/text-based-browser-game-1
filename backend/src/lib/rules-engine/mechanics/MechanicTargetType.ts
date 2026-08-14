import type { Enumify } from "@guillaume-docquier/tools-ts"

export type MechanicTargetType = Enumify<typeof MechanicTargetType>
export const MechanicTargetType = {
  FLEET: "FLEET",
  PLANET: "PLANET",
  PLAYER: "PLAYER",
} as const
