import type { Enumify } from "@guillaume-docquier/tools-ts"

export type TargetType = Enumify<typeof TargetType>
export const TargetType = {
  FLEET: "FLEET",
  PLANET: "PLANET",
  PLAYER: "PLAYER",
  // SELF: "SELF", // A special target type always defined with the "self" tag. See TargetDefinition.ts
} as const
