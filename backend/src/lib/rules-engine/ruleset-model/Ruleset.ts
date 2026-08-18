import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"

/**
 * The complete data-driven rules for a game.
 */
export type Ruleset = Readonly<{
  /**
   * The player-facing name of this Ruleset.
   */
  name: string
  actionDefinitions: Readonly<Record<string, ActionDefinition>>
}>
