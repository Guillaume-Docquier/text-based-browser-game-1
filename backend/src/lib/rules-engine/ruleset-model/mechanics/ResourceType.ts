import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ResourceType = Enumify<typeof ResourceType>
export const ResourceType = {
  MONEY: "MONEY",
} as const
