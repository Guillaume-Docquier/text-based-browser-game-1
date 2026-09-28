import type { ResourceType } from "game-rules/ruleset/effect-definitions/ResourceType.ts"

/**
 * The quantity of every resource that can be held by a player in a game, by the resource type.
 */
export type Resources = Record<ResourceType, number>
