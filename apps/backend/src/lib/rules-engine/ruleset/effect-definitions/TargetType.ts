import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type TargetType = Enumify<typeof TargetType>
export const TargetType = {
  FLEET: "FLEET",
  PLANET: "PLANET",
  PLAYER: "PLAYER",
} as const

export const TargetTypeSchema = z.enum(TargetType) satisfies z.ZodType<TargetType>
