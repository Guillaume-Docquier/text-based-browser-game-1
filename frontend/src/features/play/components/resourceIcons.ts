import type { PlayerView } from "@api-types"
import { Award, Earth, InspectionPanel, LucideDroplets, type LucideIcon, Zap } from "lucide-react"

type ResourceType = keyof PlayerView["resources"]

/** Resource display order. */
export const RESOURCE_TYPES = ["INFLUENCE", "METAL", "FUEL", "ENERGY", "COLONY"] as const satisfies readonly ResourceType[]

/** Icons used to represent Resources. */
export const RESOURCE_ICONS = {
  INFLUENCE: Award,
  METAL: InspectionPanel,
  FUEL: LucideDroplets,
  ENERGY: Zap,
  COLONY: Earth,
} as const satisfies Record<ResourceType, LucideIcon>
