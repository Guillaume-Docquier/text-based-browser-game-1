import type { Branded } from "@guillaume-docquier/tools-ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"

/**
 * The role of the target for this mechanic, such as "player", "defendingFleet" or "planet".
 */
export type TargetRole = Branded<string, "TargetRole">

export type AbstractMechanic = Readonly<{
  type: string
  /**
   * Maps target roles to their actual target.
   */
  targets: Readonly<Record<TargetRole, TargetDefinition>>

  /**
   * Unique mechanic parameters that actions can customize.
   */
  parameters: Readonly<Record<string, string | number>>
}>

/**
 * When a mechanic has no targets.
 */
export type NoTargets = Readonly<Record<TargetRole, never>>

/**
 * When a mechanic has no parameters.
 */
export type NoParameters = Readonly<Record<string, never>>
