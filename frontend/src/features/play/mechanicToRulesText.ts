import type { Mechanic } from "@api-types"

/**
 * Converts a configured Mechanic into player-facing rules text.
 */
export function mechanicToRulesText(mechanic: Mechanic): string {
  switch (mechanic.type) {
    case "RESOURCE_LOSS":
      return `Spend ${mechanic.quantity} ${formatRulesetTerm(mechanic.resourceType)}`
    case "RESOURCE_GAIN":
      return `Gain ${mechanic.quantity} ${formatRulesetTerm(mechanic.resourceType)}`
    case "VICTORY":
      return "Win the game"
  }
}

/**
 * Converts configured Mechanics into a player-facing rules sentence.
 */
export function mechanicsToRulesText(mechanics: readonly Mechanic[]): string {
  return `${mechanics.map(mechanicToRulesText).join(". ")}.`
}

/**
 * Converts a ruleset enum value into a player-facing name.
 */
export function formatRulesetTerm(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}
