import type { ActionDefinition } from "#lib/rules-engine/ruleset-model/actions/ActionDefinition.ts"

/**
 * The complete data-driven rules for a game.
 */
export type Ruleset = {
  /**
   * The player-facing name of this Ruleset.
   */
  readonly name: string
  readonly actionDefinitions: Readonly<Record<string, ActionDefinition>>
}
