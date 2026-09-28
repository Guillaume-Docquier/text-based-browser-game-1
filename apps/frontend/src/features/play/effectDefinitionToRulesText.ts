import type { EffectDefinition } from "@api-types"

/**
 * Converts a configured effect definition into player-facing rules text.
 */
export function effectDefinitionToRulesText(effectDefinition: EffectDefinition): string {
  switch (effectDefinition.type) {
    case "RESOURCE_LOSS":
      return `Spend ${effectDefinition.parameters.quantity} ${formatRulesetTerm(effectDefinition.parameters.resourceType)}`
    case "RESOURCE_GAIN":
      return `Gain ${effectDefinition.parameters.quantity} ${formatRulesetTerm(effectDefinition.parameters.resourceType)}`
    case "VICTORY":
      return "Win the game"
    case "FLEET_BUILD":
      return `Build a fleet with ${effectDefinition.parameters.strength} strength on target planet`
  }
}

/**
 * Converts configured effect definitions into a player-facing rules sentence.
 */
export function effectDefinitionsToRulesText(effectDefinitions: readonly EffectDefinition[]): string {
  return `${effectDefinitions.map(effectDefinitionToRulesText).join(". ")}.`
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
