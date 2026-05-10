import type { Enumify } from "@guillaume-docquier/tools-ts"

export type BodyType = Enumify<typeof BodyType>
export const BodyType = {
  PLANET: "PLANET",
  MOON: "MOON",
  ASTEROID: "ASTEROID",
} as const
