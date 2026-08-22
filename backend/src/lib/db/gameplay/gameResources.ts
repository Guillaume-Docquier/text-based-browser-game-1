import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

// Long term this should be data-driven, not hardcoded
export const STARTING_RESOURCE_AMOUNTS: Readonly<Record<ResourceType, number>> = {
  [ResourceType.INFLUENCE]: 3,
  [ResourceType.METAL]: 2,
  [ResourceType.FUEL]: 1,
  [ResourceType.ENERGY]: 0,
  [ResourceType.COLONY]: 0,
}
