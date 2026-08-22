import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 */
export type TargetRole = string

export type AbstractMechanic = {
  readonly type: string
  /**
   * Maps target roles to their actual target.
   */
  readonly targets: Record<TargetRole, TargetDefinition>
}
