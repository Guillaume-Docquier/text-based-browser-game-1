import type { ActionDefinition, EffectDefinition } from "@api-types"

/**
 * Converts one configured effect into player-facing rules text.
 */
export function effectDefinitionToRulesText(effectDefinition: EffectDefinition, actionDefinition: ActionDefinition): string {
  switch (effectDefinition.type) {
    case "RESOURCE_LOSS":
      return `Spend ${effectDefinition.parameters.quantity} ${formatRulesetTerm(effectDefinition.parameters.resourceType)}`
    case "RESOURCE_GAIN":
      return `Gain ${effectDefinition.parameters.quantity} ${formatRulesetTerm(effectDefinition.parameters.resourceType)}`
    case "VICTORY":
      return "Win the game"
    case "FLEET_BUILD":
      return `Build a fleet with ${effectDefinition.parameters.strength} strength on target planet`
    case "FLEET_MOVE":
      return movementRulesText(effectDefinition, actionDefinition)
    case "FLEET_ASSAULT":
    case "FLEET_COLONIZE":
      return arrivalRulesText(effectDefinition, actionDefinition)
  }
}
function arrivalRulesText(
  effectDefinition: Extract<EffectDefinition, { type: "FLEET_ASSAULT" | "FLEET_COLONIZE" }>,
  actionDefinition: ActionDefinition,
): string {
  switch (effectDefinition.type) {
    case "FLEET_ASSAULT":
      return actionDefinition.effects.some((effect) => effect.type === "FLEET_MOVE")
        ? "On arrival, join friendly fleets at the target, then attack all enemy fleets there in one simultaneous exchange"
        : "Attack all enemy fleets at the target planet in one simultaneous exchange"
    case "FLEET_COLONIZE":
      return actionDefinition.effects.some((effect) => effect.type === "FLEET_MOVE")
        ? `On arrival, claim the unclaimed target planet; success consumes ${effectDefinition.parameters.strengthRequirement} fleet strength`
        : `Claim the unclaimed planet at the selected fleet's current location; success consumes ${effectDefinition.parameters.strengthRequirement} fleet strength`
  }
}
function movementRulesText(
  effectDefinition: Extract<EffectDefinition, { type: "FLEET_MOVE" }>,
  actionDefinition: ActionDefinition,
): string {
  const planetTarget = actionDefinition.targets[effectDefinition.targets.planet.actionTargetTag]
  const maximumReach = planetTarget?.constraints
    .filter(
      (constraint) =>
        constraint.type === "WITHIN_FLEET_RANGE" && constraint.references.sourceFleetTag === effectDefinition.targets.fleet.actionTargetTag,
    )
    .reduce<number | undefined>(
      (minimum, constraint) =>
        minimum === undefined ? constraint.parameters.maxDistance : Math.min(minimum, constraint.parameters.maxDistance),
      undefined,
    )
  const rangeText = maximumReach === undefined ? "" : `, within a range of ${formatDistance(maximumReach)}`

  return `Move a fleet to the target planet at ${formatDistance(effectDefinition.parameters.speed)} per turn${rangeText}`
}

/**
 * Converts a configured action into a player-facing rules sentence.
 */
export function effectDefinitionsToRulesText(actionDefinition: ActionDefinition): string {
  return `${actionDefinition.effects.map((effect) => effectDefinitionToRulesText(effect, actionDefinition)).join(". ")}.`
}

/**
 * Converts a ruleset enum value into a player-facing name.
 */
export function formatRulesetTerm(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}

function formatDistance(distance: number): string {
  return `${distance.toLocaleString()} ${distance === 1 ? "light year" : "light years"}`
}
