import type { Enumify } from "@guillaume-docquier/tools-ts"

export type ResourceType = Enumify<typeof ResourceType>
export const ResourceType = {
  MONEY: "MONEY",
} as const

// Long term this should be data-driven, not hardcoded
export const STARTING_RESOURCE_AMOUNTS: Readonly<Record<ResourceType, number>> = {
  [ResourceType.MONEY]: 0,
}
