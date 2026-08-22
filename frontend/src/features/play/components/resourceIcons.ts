import type { PlayerView } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { Award, Earth, InspectionPanel, LucideDroplets, type LucideIcon, Zap } from "lucide-react"

type ResourceType = keyof PlayerView["resources"]
type Resource = { readonly resourceType: ResourceType }

const ResourceRank = {
  INFLUENCE: 1,
  METAL: 2,
  ENERGY: 3,
  FUEL: 4,
  COLONY: 5,
} as const satisfies Record<ResourceType, number>

/** Sorts resource-bearing values in their canonical display order. */
export function sortResources<T extends Resource>(resources: readonly T[]): T[] {
  return resources.toSorted((first, second) => Sort.byAscending(ResourceRank[first.resourceType], ResourceRank[second.resourceType]))
}

/** Icons used to represent Resources. */
export const RESOURCE_ICONS = {
  INFLUENCE: Award,
  METAL: InspectionPanel,
  FUEL: LucideDroplets,
  ENERGY: Zap,
  COLONY: Earth,
} as const satisfies Record<ResourceType, LucideIcon>
