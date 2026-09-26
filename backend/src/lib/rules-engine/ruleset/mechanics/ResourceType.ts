import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

export type ResourceType = Enumify<typeof ResourceType>
export const ResourceType = {
  INFLUENCE: "INFLUENCE",
  METAL: "METAL",
  FUEL: "FUEL",
  ENERGY: "ENERGY",
  COLONY: "COLONY",
} as const

export const ResourceTypeSchema = z.enum(ResourceType)
