import type { Mechanic } from "@api-types"

/**
 * Converts a configured Mechanic into player-facing rules text.
 */
export function mechanicToRulesText(mechanic: Mechanic): string {
  switch (mechanic.type) {
    case "RESOURCE_LOSS":
      return `Spend ${mechanic.quantity} ${formatResourceType(mechanic.resourceType)}`
    case "RESOURCE_GAIN":
      return `Gain ${mechanic.quantity} ${formatResourceType(mechanic.resourceType)}`
    case "VICTORY":
      return "Win the game"
  }
}

/**
 * Converts a ResourceType into a player-facing name.
 */
export function formatResourceType(resourceType: string): string {
  return resourceType
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}
