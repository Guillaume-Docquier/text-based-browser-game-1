import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ResourceType = Enumify<typeof ResourceType>
export const ResourceType = {
  INFLUENCE: "INFLUENCE",
  METAL: "METAL",
  FUEL: "FUEL",
  ENERGY: "ENERGY",
  COLONY: "COLONY",
} as const
