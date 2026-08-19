import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

// Long term this should be data-driven, not hardcoded
export const STARTING_RESOURCE_AMOUNTS: Readonly<Record<ResourceType, number>> = {
  [ResourceType.MONEY]: 2,
}
