import type { ResourceType } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { Award, Earth, InspectionPanel, LucideDroplets, type LucideIcon, Zap } from "lucide-react"

const ResourceRank = {
  INFLUENCE: 1,
  METAL: 2,
  ENERGY: 3,
  FUEL: 4,
  COLONY: 5,
} as const satisfies Record<ResourceType, number>

/** Sorts costs in their canonical display order. */
export function sortCostsByResource<T extends { readonly resourceType: ResourceType }>(costs: readonly T[]): T[] {
  return costs.toSorted((first, second) => Sort.byAscending(ResourceRank[first.resourceType], ResourceRank[second.resourceType]))
}

export const RESOURCE_ICONS = {
  INFLUENCE: Award,
  METAL: InspectionPanel,
  FUEL: LucideDroplets,
  ENERGY: Zap,
  COLONY: Earth,
} as const satisfies Record<ResourceType, LucideIcon>
