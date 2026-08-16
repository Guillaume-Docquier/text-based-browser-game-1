import type { ActionDefinition } from "#lib/rules-engine/ruleset/actions/ActionDefinition.ts"

/**
 * The action definition targets are always an empty string.
 * The resolved targets point to actual target ids.
 */
export type ResolvedTargets = {
  [TargetTag in keyof ActionDefinition["targets"]]: string
}
